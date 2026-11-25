package com.longcon.core

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.TestFactory

/**
 * Runs the shared golden vectors directly from contracts/vectors/.
 *
 * Both the TypeScript and Kotlin engines must pass these same files. When a case
 * fails, the bug is in Kotlin (or the vector must be changed by Mofe — never here).
 */
class ContractVectorTest {

    private val contract = TacticsContract.parse(RepoPaths.readText("tactics.json"))
    private val riskEngine = RiskEngine(contract)
    private val rulesEngine = RulesEngine(contract)

    @TestFactory
    fun `risk vectors`(): List<DynamicTest> {
        val cases = RepoPaths.json("vectors/risk.json").jsonArray
        check(cases.isNotEmpty()) { "risk.json has no cases" }

        return cases.map { element ->
            val case = element.jsonObject
            val name = case["name"]!!.jsonPrimitive.content

            dynamicTest(name) {
                val tagged = case["input"]!!.jsonArray.map { inputElement ->
                    val input = inputElement.jsonObject
                    TaggedMessage(
                        messageId = input["messageId"]!!.jsonPrimitive.content,
                        contactId = "c",
                        sentAt = input["sentAt"]!!.jsonPrimitive.long,
                        hits = input["tactics"]!!.jsonArray.map { tactic ->
                            TacticHit(tactic.jsonPrimitive.content, tactic.jsonPrimitive.content)
                        },
                        route = Route.fromWire(input["route"]!!.jsonPrimitive.content),
                    )
                }

                val actual = riskEngine.scoreContact("c", tagged)
                val expected = case["expect"]!!.jsonObject

                assertEquals(expected["score"]!!.jsonPrimitive.int, actual.score, "$name: score")
                assertEquals(expected["level"]!!.jsonPrimitive.content, actual.level.wire, "$name: level")

                val stageElement = expected["stageReached"]
                val expectedStage = if (stageElement == null || stageElement is JsonNull) {
                    null
                } else {
                    stageElement.jsonPrimitive.content
                }
                assertEquals(expectedStage, actual.stageReached, "$name: stageReached")

                assertEquals(expected["shouldCheck"]!!.jsonPrimitive.boolean, actual.shouldCheck, "$name: shouldCheck")
                assertEquals(expected["shouldEscalate"]!!.jsonPrimitive.boolean, actual.shouldEscalate, "$name: shouldEscalate")
                assertEquals(
                    expected["days"]!!.jsonArray.map { it.jsonPrimitive.long },
                    actual.timeline.map { it.day },
                    "$name: days",
                )
            }
        }
    }

    @TestFactory
    fun `rules vectors`(): List<DynamicTest> {
        val cases = RepoPaths.json("vectors/rules.json").jsonArray
        check(cases.isNotEmpty()) { "rules.json has no cases" }

        return cases.map { element ->
            val case = element.jsonObject
            val text = case["text"]!!.jsonPrimitive.content

            dynamicTest(text.take(60)) {
                val expected = case["tactics"]!!.jsonArray.map { it.jsonPrimitive.content }
                val actual = rulesEngine.tag(text).map { it.tactic }
                assertEquals(expected, actual, "rules prefilter for: $text")
            }
        }
    }

    @TestFactory
    fun `hash vectors`(): List<DynamicTest> {
        val root = RepoPaths.json("vectors/hash.json").jsonObject
        val secretHex = root["secretHex"]!!.jsonPrimitive.content
        val hasher = HouseholdHasher(secretHex)
        val cases = root["cases"]!!.jsonArray
        check(cases.isNotEmpty()) { "hash.json has no cases" }

        return cases.map { element ->
            val case = element.jsonObject
            val handle = case["handle"]!!.jsonPrimitive.content

            dynamicTest(handle) {
                assertEquals(
                    case["normalised"]!!.jsonPrimitive.content,
                    HandleNormaliser.normalise(handle),
                    "normalise($handle)",
                )
                assertEquals(case["hash"]!!.jsonPrimitive.content, hasher.hash(handle), "HMAC($handle)")
            }
        }
    }
}
