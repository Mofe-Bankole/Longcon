package com.longcon.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Parsed form of contracts/tactics.json.
 *
 * Everything the Kotlin core knows about scam tactics — ids, stages, weights and the
 * rung-1 regexes — comes from this JSON. No tactic id, weight or pattern is hardcoded
 * in Kotlin, so the TS and Android engines stay in step.
 */
data class TacticDef(
    val id: String,
    val stage: String,
    val weight: Double,
    val label: String,
    val plain: String,
    val definition: String,
    val rules: List<String>,
)

data class LevelThresholds(
    val watch: Double,
    val warning: Double,
    val danger: Double,
)

data class RiskConfig(
    val escalateAt: Double,
    val checkAt: Double,
    val levels: LevelThresholds,
    val progressionBonus: Double,
    val repeatFactor: Double,
    val rulesDiscount: Double,
    val saturation: Double,
    /** Remote Config may override individual weights; missing ids fall back to the tactic's own weight. */
    val weights: Map<String, Double> = emptyMap(),
)

class TacticsContract(
    val version: Int,
    val stages: List<String>,
    val stageLabels: Map<String, String>,
    val riskConfig: RiskConfig,
    val tactics: List<TacticDef>,
) {
    private val byId: Map<String, TacticDef> = tactics.associateBy { it.id }

    init {
        require(stages.isNotEmpty()) { "tactics.json: stages is empty" }
        require(tactics.isNotEmpty()) { "tactics.json: tactics is empty" }
        require(byId.size == tactics.size) { "tactics.json: duplicate tactic id" }
        for (t in tactics) {
            require(t.stage in stages) { "tactics.json: tactic ${t.id} has unknown stage ${t.stage}" }
        }
        for (id in riskConfig.weights.keys) {
            require(byId.containsKey(id)) { "tactics.json: weight override for unknown tactic $id" }
        }
    }

    fun tactic(id: String): TacticDef = byId[id] ?: error("tactics.json: unknown tactic $id")

    companion object {
        fun parse(json: String): TacticsContract {
            val root = Json.parseToJsonElement(json).jsonObject
            val stages = root.array("stages").map { it.jsonPrimitive.content }
            val stageLabels = root.obj("stageLabels").mapValues { it.value.jsonPrimitive.content }
            val cfg = root.obj("riskConfig")
            val levels = cfg.obj("levels")
            val weights = (cfg["weights"] as? JsonObject)
                ?.mapValues { it.value.jsonPrimitive.double }
                ?: emptyMap()

            return TacticsContract(
                version = root.int("version"),
                stages = stages,
                stageLabels = stageLabels,
                riskConfig = RiskConfig(
                    escalateAt = cfg.double("escalateAt"),
                    checkAt = cfg.double("checkAt"),
                    levels = LevelThresholds(
                        watch = levels.double("watch"),
                        warning = levels.double("warning"),
                        danger = levels.double("danger"),
                    ),
                    progressionBonus = cfg.double("progressionBonus"),
                    repeatFactor = cfg.double("repeatFactor"),
                    rulesDiscount = cfg.double("rulesDiscount"),
                    saturation = cfg.double("saturation"),
                    weights = weights,
                ),
                tactics = root.array("tactics").map { element ->
                    val t = element.jsonObject
                    TacticDef(
                        id = t.string("id"),
                        stage = t.string("stage"),
                        weight = t.double("weight"),
                        label = t.string("label"),
                        plain = t.string("plain"),
                        definition = t.string("definition"),
                        rules = t.array("rules").map { it.jsonPrimitive.content },
                    )
                },
            )
        }
    }
}

private fun JsonObject.string(key: String): String =
    requireNotNull(this[key]) { "tactics.json: missing $key" }.jsonPrimitive.content

private fun JsonObject.int(key: String): Int =
    requireNotNull(this[key]) { "tactics.json: missing $key" }.jsonPrimitive.int

private fun JsonObject.double(key: String): Double =
    requireNotNull(this[key]) { "tactics.json: missing $key" }.jsonPrimitive.double

private fun JsonObject.obj(key: String): JsonObject =
    requireNotNull(this[key]) { "tactics.json: missing $key" }.jsonObject

private fun JsonObject.array(key: String): List<JsonElement> =
    requireNotNull(this[key]) { "tactics.json: missing $key" }.jsonArray
