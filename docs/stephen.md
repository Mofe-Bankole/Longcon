# Stephen: scope and milestones

You own **Android, CI, the corpus and the video** end to end. Mofe owns the web, extension, backend, cloud judge,
guardian dashboard and write-up, and has the final say on architecture.
Design is locked in [`architecture.md`](architecture.md). Read §2.3 (Android background) and §2.4 (household) closely.

Target: **top 3 at #BuildHybridAI 2026.** Submission closes **Mon Nov 30, 18:00 WAT**. Deadlines are hard (Parkinson's law). If one is going to slip, say so early, not at 23:58.

---

## What you own

| Area | Deliverable |
|---|---|
| Android app (`apps/android`) | Notification listener sensor, rules prefilter, encrypted local store, Nano tagger, tap-to-check, backlog drain, share target (text + screenshot), household sync, FCM, protected-person UI |
| Kotlin risk engine | A port of `packages/core/src/risk.ts`. **Must pass every `/contracts/vectors` case**, the same ones TS passes |
| CI | GitHub Actions: Android build + tests on every PR, APK artifact. Add the TS `pnpm test` job too |
| Synthetic corpus | Realistic multi-week conversations with ground-truth labels per message. Used for demos and the benchmark |
| Benchmark (Android half) | Latency + accuracy, on_device vs in_cloud, on the Galaxy |
| Demo footage + video edit | Phone screen recordings, final cut **2:50–3:00** (the rules cap it at 3:00). Mofe writes and narrates |

Your calls: Compose vs Views, DI, the Room encryption approach (SQLCipher or Keystore-wrapped), architecture inside the app, test framework.
Not your calls (raise them with Mofe): anything that changes the privacy rules, the contracts, the Firestore schema or the
route labels.

## Non-negotiables
1. **Message text never leaves the phone.** Firestore gets signals only (§2.4). The cloud judge gets a redacted summary only.
2. **No silent cloud fallback.** The tagger defaults to `ONLY_ON_DEVICE`. `PREFER_ON_DEVICE` only behind an explicit user toggle.
3. **Every signal carries its route** (`rules` / `on_device` / `in_cloud`), and the UI shows it.
4. **Nano runs only in the foreground.** Never try to get around `BACKGROUND_USE_BLOCKED`. The design already accounts for it (§2.3).
5. Contracts are the source of truth. If Kotlin disagrees with a vector, the bug is in Kotlin, or the vector needs changing. Raise it; don't fork it.
6. Never commit secrets: `google-services.json`, debug tokens, keystores, `.env.local`.

## Interfaces between us
| From Mofe → you | When |
|---|---|
| `/contracts`: `tactics.json` (incl. rules-prefilter regexes), `tag.schema.json`, `event/contact.schema.json`, `vectors/*.json` | **Thu Nov 19, 12:00 WAT** |
| HMAC contact-hash vectors (`normalise(handle)` rules + expected hashes) | with the contracts |
| Cloud judge request/response shape + the redacted-summary builder spec | Sat Nov 21 |
| Firestore rules + pairing QR payload format | Sun Nov 22 |

| From you → Mofe | When |
|---|---|
| Corpus v1 in `contracts/corpus/` (the TS demo inbox uses it too) | Thu Nov 19, 23:59 |
| Real-device numbers + recordings | per milestone below |

---

## Milestones

### M0 Spike: **Wed Nov 18, 23:59** (tonight)
Full checklist: [`m0-stephen.md`](m0-stephen.md).
- On the GCP VM: `route: "on_device"` in the web spike **and in the extension side panel**, plus a latency table (5 samples × on_device/cloud).
  If the side panel fails, send the exact error and stop. That's an architecture decision.
- `apps/android` scaffold: hybrid hello-world showing the route + `checkStatus()`, App Check debug provider, CI producing an APK.

### M1 Slice: **Thu Nov 19, 23:59**
- `NotificationListenerService`: capture WhatsApp / SMS / Messenger / Telegram / Gmail via `MessagingStyle` extras. Dedupe
  (notifications repost on every update), normalise sender, drop group noise. Onboarding grants notification access + battery-optimisation exemption.
- Encrypted Room store: messages, contacts, tagged events, a backlog queue.
- Rules prefilter (rung 1), driven by `tactics.json`, so no hardcoded patterns. Runs instantly in the listener.
- Kotlin risk engine, **green on all vectors in CI**.
- Minimal UI: contacts list → per-contact timeline (tactic, stage, route badge, score).
- **Corpus v1:** 3 scam arcs (romance/"oil rig engineer" over 3 weeks, crypto investment, fake job) + 3 benign look-alikes
  (a real long-distance partner, a real recruiter, family asking for money). 40–80 messages each, timestamps across weeks,
  per-message expected tactics. The benign ones are as important as the scams; false positives sink the pitch.

### M2 Escalate: **Sat Nov 21, 23:59**
- Nano tagger on Android via Firebase AI Logic. Same system prompt and schema as TS (from contracts), `ONLY_ON_DEVICE` default,
  consent toggle for `PREFER_ON_DEVICE`. Parse defensively, like `parseHits`.
- **Tap to check:** a contact's rules score crosses the check threshold → one notification → the tap opens Longcon → Nano tags that contact's backlog first.
- **Foreground drain:** whenever the app is foreground, drain the backlog by rules-score priority, with exponential backoff on `BUSY`/quota.
  The UI shows "N messages checked privately on this phone".
- **Handle extraction** on `move_off_platform` ("add me on Telegram @eng_mark") → stored for cross-channel linking.
- **Share target:** text and screenshots (`ACTION_SEND`) → Nano multimodal → tags.
- Unconfirmed pattern: rules-only score above the threshold for 6h with no tap → flagged `rules`, ready for the guardian.
- Escalation (score ≥ `escalateAt`) → call the cloud judge with the redacted summary (shape from Mofe) → show the verdict + verification questions.

### M3 Household: **Mon Nov 23, 23:59**
- Anonymous Auth. Scan the pairing QR → join the household, store `householdSecret` in Keystore (never in Firestore).
- `cHash = HMAC-SHA256(householdSecret, normalise(handle))`, **matching the TS vectors byte for byte.**
- Write `events`, `contacts`, `links` per §2.4. Verify that no text, quotes or raw handles go over the wire (log the payloads and check).
- Cross-channel: the email contact on the laptop and the Telegram handle on the phone appear as one timeline.
- FCM: register the token on `members/{uid}`. The guardian role on Android receives alerts and opens the contact pattern.
- Remote Config: tactics, weights and thresholds fetched at runtime, with the bundled contracts as defaults.

### M4 Proof: **Wed Nov 25, 23:59**
- Benchmark on the Galaxy over the full corpus: per-message latency (p50/p95), tactic precision/recall,
  **on_device vs in_cloud**, and arc-level: on which day each scam would have been flagged vs when the "send money" message came.
  Write the results as JSON to `bench/android/` so Mofe can chart them.
- Battery/thermal note for the drain (a 30-minute run is enough).
- Polish the protected-person UI for a 65+ user: large text, plain words, read-aloud on verdicts, one clear action per screen.
- Record the raw demo footage (Margaret's scenario, phone side) in clean takes: notification arrives → tap to check →
  timeline → guardian alert on the second phone.

### Freeze: **Fri Nov 27, 12:00.** Bug fixes only after this.
### Ship: **Sun Nov 29, 23:59.** Final video cut (2:50–3:00) uploaded unlisted on YouTube; signed release APK attached to a GitHub release.
### Submit: **Mon Nov 30, 18:00 WAT.** Mofe submits. Be reachable 12:00–18:00.

---

## How we work
- Branch per feature → PR to `main` → CI green → merge. Small PRs; Mofe reviews contract-touching ones, and the rest you merge.
- Daily async update, posted by 22:00 WAT: done / next / blocked. Three lines.
- Blocked over 2 hours on something only Mofe can unblock (access, contracts, a design call): message immediately.
- Device: Mofe is sourcing a Nano-capable Galaxy (S24/S25 class). Until it arrives, build against the cloud route with the consent
  toggle on and keep the Nano path behind `checkStatus()`. Everything up to M2 should be testable without it.
