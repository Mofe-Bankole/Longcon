package com.longcon.core

import kotlin.math.exp
import kotlin.math.ln

enum class Route(val wire: String) {
    RULES("rules"),
    ON_DEVICE("on_device"),
    IN_CLOUD("in_cloud");

    companion object {
        fun fromWire(value: String): Route =
            entries.firstOrNull { it.wire == value } ?: error("unknown route: $value")
    }
}

enum class RiskLevel(val wire: String) {
    CLEAR("clear"),
    WATCH("watch"),
    WARNING("warning"),
    DANGER("danger"),
}

data class TacticHit(
    val tactic: String,
    /** Short quote from the message that shows the tactic. Stays on device. */
    val evidence: String,
)

data class TaggedMessage(
    val messageId: String,
    val contactId: String,
    val sentAt: Long,
    val hits: List<TacticHit>,
    val route: Route,
    val latencyMs: Long = 0,
)

data class TimelineEvent(
    val messageId: String,
    val route: Route,
    /** Days since the first message with this contact. */
    val day: Long,
    val sentAt: Long,
    val tactic: String,
    val stage: String,
    val evidence: String,
)

data class ContactRisk(
    val contactId: String,
    val firstSeenAt: Long,
    val lastSeenAt: Long,
    val messagesScanned: Int,
    /** 0–100. */
    val score: Int,
    val level: RiskLevel,
    val stageReached: String?,
    val timeline: List<TimelineEvent>,
    val shouldEscalate: Boolean,
    val shouldCheck: Boolean,
    val routes: Map<Route, Int>,
)

/**
 * Deterministic port of packages/core/src/risk.ts. The models only label individual
 * messages; this engine owns the score, level, arc stage and sticky thresholds.
 */
class RiskEngine(private val contract: TacticsContract) {

    val config: RiskConfig = contract.riskConfig

    fun emptyRisk(contactId: String, at: Long): ContactRisk = ContactRisk(
        contactId = contactId,
        firstSeenAt = at,
        lastSeenAt = at,
        messagesScanned = 0,
        score = 0,
        level = RiskLevel.CLEAR,
        stageReached = null,
        timeline = emptyList(),
        shouldEscalate = false,
        shouldCheck = false,
        routes = emptyRoutes(),
    )

    fun applyTagged(prev: ContactRisk, tagged: TaggedMessage): ContactRisk {
        val firstSeenAt = minOf(prev.firstSeenAt, tagged.sentAt)
        val newEvents = tagged.hits.map { hit ->
            TimelineEvent(
                messageId = tagged.messageId,
                route = tagged.route,
                day = 0,
                sentAt = tagged.sentAt,
                tactic = hit.tactic,
                stage = contract.tactic(hit.tactic).stage,
                evidence = hit.evidence.take(120),
            )
        }
        val timeline = (prev.timeline + newEvents)
            .sortedBy { it.sentAt }
            .map { it.copy(day = Math.floorDiv(it.sentAt - firstSeenAt, DAY_MS)) }

        val next = prev.copy(
            firstSeenAt = firstSeenAt,
            lastSeenAt = maxOf(prev.lastSeenAt, tagged.sentAt),
            messagesScanned = prev.messagesScanned + 1,
            timeline = timeline,
        )
        return rescore(next)
    }

    fun rescore(risk: ContactRisk): ContactRisk {
        val counts = LinkedHashMap<String, Int>()
        val confirmed = HashSet<String>()
        val routes = emptyRoutes().toMutableMap()
        for (event in risk.timeline) {
            counts[event.tactic] = (counts[event.tactic] ?: 0) + 1
            if (event.route != Route.RULES) confirmed += event.tactic
            routes[event.route] = (routes[event.route] ?: 0) + 1
        }

        var raw = 0.0
        for ((tactic, count) in counts) {
            val weight = (config.weights[tactic] ?: contract.tactic(tactic).weight) *
                (if (tactic in confirmed) 1.0 else config.rulesDiscount)
            raw += weight * (1.0 + config.repeatFactor * log2(count.toDouble()))
        }

        val stagesSeen = LinkedHashSet<String>()
        for (event in risk.timeline) stagesSeen += event.stage
        var stageIdx = -1
        contract.stages.forEachIndexed { index, stage -> if (stage in stagesSeen) stageIdx = index }
        val ordered = isOrderedArc(risk.timeline)
        val progression = 1.0 + config.progressionBonus * maxOf(0, stagesSeen.size - 1) * (if (ordered) 1.0 else 0.5)

        val score = Math.round(100.0 * (1.0 - exp(-(raw * progression) / config.saturation))).toInt()
        val capped = capLevel(levelFor(score), EXTRACTION_STAGE in stagesSeen)

        return risk.copy(
            score = score,
            level = capped,
            stageReached = if (stageIdx >= 0) contract.stages[stageIdx] else null,
            shouldEscalate = risk.shouldEscalate || score >= config.escalateAt,
            shouldCheck = risk.shouldCheck || score >= config.checkAt,
            routes = routes.toMap(),
        )
    }

    fun isOrderedArc(timeline: List<TimelineEvent>): Boolean {
        val firstSeen = mutableListOf<Int>()
        for (event in timeline) {
            val index = contract.stages.indexOf(event.stage)
            if (index >= 0 && index !in firstSeen) firstSeen += index
        }
        return firstSeen.zipWithNext().all { (a, b) -> b >= a }
    }

    fun levelFor(score: Int): RiskLevel = when {
        score >= config.levels.danger -> RiskLevel.DANGER
        score >= config.levels.warning -> RiskLevel.WARNING
        score >= config.levels.watch -> RiskLevel.WATCH
        else -> RiskLevel.CLEAR
    }

    /** Score a contact from scratch from its tagged messages, in time order. */
    fun scoreContact(contactId: String, tagged: List<TaggedMessage>): ContactRisk {
        val sorted = tagged.sortedWith(compareBy<TaggedMessage> { it.sentAt }.thenBy { it.messageId })
        val start = sorted.firstOrNull()?.sentAt ?: 0L
        return sorted.fold(emptyRisk(contactId, start)) { risk, message -> applyTagged(risk, message) }
    }

    private fun capLevel(level: RiskLevel, extractionSeen: Boolean): RiskLevel =
        if (level == RiskLevel.DANGER && !extractionSeen) RiskLevel.WARNING else level

    private fun emptyRoutes(): Map<Route, Int> = linkedMapOf(
        Route.RULES to 0,
        Route.ON_DEVICE to 0,
        Route.IN_CLOUD to 0,
    )

    private fun log2(value: Double): Double = ln(value) / ln(2.0)

    private companion object {
        const val DAY_MS = 86_400_000L
        const val EXTRACTION_STAGE = "extraction"
    }
}
