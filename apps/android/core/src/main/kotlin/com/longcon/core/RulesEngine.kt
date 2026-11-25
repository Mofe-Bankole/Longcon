package com.longcon.core

import java.util.regex.Matcher
import java.util.regex.Pattern

/**
 * Rung 1 of the privacy ladder: the instant keyword/regex prefilter.
 * Mirrors packages/core/src/rules.ts: tactics in contract order, each tactic's patterns
 * in contract order, case-insensitive Unicode matching, first match per tactic only.
 */
class RulesEngine(private val contract: TacticsContract) {

    private val compiled: List<Pair<TacticDef, List<Pattern>>> = contract.tactics.map { tactic ->
        tactic to tactic.rules.map { pattern ->
            Pattern.compile(pattern, Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE)
        }
    }

    fun tag(text: String): List<TacticHit> {
        val hits = mutableListOf<TacticHit>()
        for ((tactic, patterns) in compiled) {
            for (pattern in patterns) {
                val matcher: Matcher = pattern.matcher(text)
                if (matcher.find()) {
                    hits += TacticHit(tactic.id, around(text, matcher.start(), matcher.end() - matcher.start()))
                    break
                }
            }
        }
        return hits
    }

    /** The match plus a little context, trimmed to word boundaries, at most 120 chars. */
    private fun around(text: String, start: Int, len: Int): String {
        val pad = maxOf(0, (120 - len) / 2)
        var a = maxOf(0, start - pad)
        var b = minOf(text.length, start + len + pad)
        if (a > 0) {
            val space = text.indexOf(' ', a)
            if (space >= 0) a = space + 1
        }
        if (b < text.length) {
            val space = text.lastIndexOf(' ', b)
            if (space > start + len) b = space
        }
        return text.substring(a, b).trim().take(120)
    }
}
