# Longcon Android (M0 scaffold)

Gradle Kotlin DSL project, JDK 17 bytecode target.

- `core/` — pure Kotlin JVM (no Android dependencies): `TacticsContract` parser,
  `RulesEngine`, `RiskEngine`, `HouseholdHasher`. All tactic ids, stages, weights and
  regexes come from `contracts/tactics.json`; nothing is duplicated in Kotlin.
- `app/` — Android app (`com.longcon.app`, minSdk 26, Compose). No Firebase yet.
  `contracts/tactics.json` is copied into the APK assets at build time.

## Commands

```bash
./gradlew :core:test          # shared vectors from contracts/vectors/*.json
./gradlew :app:assembleDebug  # app-debug.apk
```

The tests read `contracts/vectors/{risk,rules,hash}.json` in place. If a case fails,
fix Kotlin; the vectors are owned by Mofe and must not be edited.
