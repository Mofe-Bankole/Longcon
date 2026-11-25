# Contracts

Shared by the TypeScript core (`packages/core`) and the Kotlin app (`apps/android`). If the two disagree,
one of them has a bug. Changes go through Mofe, and every change regenerates the vectors.

| File | What | Who reads it |
|---|---|---|
| `tactics.json` | 12 tactics (stage, weight, labels, model definition, rules regexes) + `riskConfig` | TS `tactics.ts`/`risk.ts`, Kotlin (bundle as an asset) |
| `vectors/risk.json` | Tagged-message sequences → expected `score/level/stageReached/shouldCheck/shouldEscalate/days` | both test suites |
| `vectors/rules.json` | Text → tactics the rules prefilter must return | both |
| `vectors/hash.json` | Household secret + handles → `normalised` + HMAC hash | both |

Tagger output schemas are in `packages/core/src/prompts.ts` (`TAG_SCHEMA`, `BATCH_TAG_SCHEMA`).
Android uses the single-message schema (4k-token window), and web uses the batch schema.

Regenerate after changing the TS engine or `tactics.json`: `GEN_VECTORS=1 pnpm --filter @longcon/core test`.

## Algorithms (port exactly)

**Rules prefilter.** For each tactic in file order, test its patterns in order, case-insensitively
(`Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE`). The first match gives one hit for that tactic. The hit list comes out in tactic order.

**Risk score** (`risk.ts`). Sort events by `sentAt`. Then:
- `raw = Σ over distinct tactics: weight × (confirmed ? 1 : rulesDiscount) × (1 + repeatFactor × log2(count))`.
  A tactic is *confirmed* if any of its events has a route other than `rules`.
- `progression = 1 + progressionBonus × (distinctStages − 1) × (orderedArc ? 1 : 0.5)`. A stage list is *ordered* if, by first
  appearance, the stage indices never go down.
- `score = round(100 × (1 − exp(−raw × progression / saturation)))`. Round half up; for positive values Kotlin `Math.round` matches JS.
- `level`: compare against `levels` thresholds, then cap: **fewer than 2 distinct stages → at most `watch`**;
  otherwise **`danger` → `warning` unless an `extraction`-stage tactic was seen**.
- `shouldCheck = score ≥ checkAt` and `shouldEscalate = score ≥ escalateAt`. Both are sticky while folding.
- `day = floor((sentAt − firstSentAt) / 86_400_000)`.

**Contact hash.** `hex(HMAC-SHA256(secretBytes, utf8(normaliseHandle(handle))))`, with `normaliseHandle`:
trim + lowercase; then `email:<s>` if it looks like an email; `phone:<+?digits>` if it is only `+ digits space ( ) . -`
with ≥ 7 digits; otherwise `handle:<s without leading @, whitespace collapsed>`.
