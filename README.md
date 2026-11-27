# Longcon

**Catch the scams that take weeks, without your chats leaving your device.**

Romance, crypto and fake-job scams don't look dangerous in any single message. They build up over weeks:
first affection, then "let's move to Telegram", then "don't tell your children", then "send it as USDT".
Longcon reads that long game on your own device with **Gemini Nano via Firebase AI Logic**, and warns the
person in plain words, before the money goes.

- **Try it:** https://longcon.web.app (six made-up conversations you can replay; works without Nano via an opt-in cloud mode)
- **How it works, limits, evidence:** https://longcon.web.app/#/about
- **Video:** _link added at submission_

## Hybrid inference: who does what

| Step | Where | Why there |
|---|---|---|
| Quick check of every message (keyword patterns) | On device, instant | Free and immediate; never enough on its own to say "scam" |
| Label every message for 12 warning signs (structured JSON) | **On device: Gemini Nano**, `ONLY_ON_DEVICE`, batched + cached | Scanning every chat in the cloud would mean uploading everyone's private messages |
| Score the arc (getting close → cutting you off → the story → asking for money) | On device, deterministic | Auditable; identical on web and Android (shared test vectors) |
| Second opinion on flagged conversations | **Cloud: Gemini** with Google Search grounding (falls back to Gemini alone without the paid plan) | Needs a bigger model and the web. Receives only a **redacted list of warning signs**, never the conversation, and the UI shows exactly what was sent |

**No silent fallback.** If Nano isn't available, Longcon keeps doing the quick check and *asks* before any
message goes to the cloud (`PREFER_ON_DEVICE` only with consent). Every result is labelled with where it ran
(`inferenceSource`). **App Check** guards every AI call.

## Repo layout

```
contracts/        tactics.json, golden test vectors, labelled corpus: shared by TypeScript and Kotlin
packages/core     router (privacy ladder), rules, risk engine, Nano tagger, cloud judge, redaction, hashing
packages/ui       design tokens, the Arc, route badges
apps/web          demo inbox, Longcon panel, benchmark (#/bench), How it works (#/about)
apps/extension    Chrome MV3 side panel (on-device spike)
apps/android      Kotlin app + Kotlin core passing the same vectors (CI builds the APK)
docs/             architecture, design, video script, team handoffs
```

Key files: [`ai.ts`](packages/core/src/ai.ts) (Firebase AI Logic hybrid models), [`router.ts`](packages/core/src/router.ts),
[`risk.ts`](packages/core/src/risk.ts), [`judge.ts`](packages/core/src/judge.ts), [`docs/architecture.md`](docs/architecture.md),
[`docs/design.md`](docs/design.md).

## Run it

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local     # your Firebase web config + App Check settings
pnpm dev:web                   # http://localhost:5173
pnpm test                      # TS: rules, risk engine, router, judge, contract vectors, corpus evaluation
cd apps/android && ./gradlew :core:test :app:assembleDebug   # Kotlin vectors + APK
```

On-device inference needs desktop Chrome with Gemini Nano enabled (`chrome://flags` → *Prompt API for Gemini Nano*,
*Enables optimization guide on device*), and the model downloaded (`chrome://on-device-internals`).
See [docs/demo-machine.md](docs/demo-machine.md).

### Firebase setup
1. Create a Firebase project → **AI Logic** → **Gemini Developer API**.
2. Register a **Web app** and copy its config into `.env.local`.
3. **App Check:** register the web app with **reCAPTCHA Enterprise** (Google Cloud console → Security → reCAPTCHA,
   a website key for your hosting domains). For local development and the extension, set `VITE_APPCHECK_DEBUG_TOKEN=true`, copy
   the token printed in the console, and register it under App Check → *Manage debug tokens*.
4. Deploy the demo: `bash scripts/deploy-web.sh` (builds without the debug token and refuses to deploy if it finds one).

## Honest limits
See [How it works → Limits](https://longcon.web.app/#/about). In short: Nano needs capable desktop Chrome; the demo
conversations are made up; Android Nano only runs while the app is open; the guardian dashboard, household sync and
iOS are designed but not built.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
