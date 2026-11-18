# Longcon architecture (locked 2026-11-17)

> Scams happen anywhere, anytime, on any device. Longcon goes with the person: laptop, Android,
> and (later) iOS. Each device senses locally, decides locally, and shares only *signals*.

## 1. Principles

1. **Message text never leaves the device it arrived on.** Only derived signals sync.
2. **Most private route first.** Every check goes down a fixed ladder: rules → on-device model → cloud,
   and the cloud only ever sees a redacted pattern summary, never raw chats.
3. **No silent fallback.** If the on-device model is unavailable, Longcon does *not* quietly use the cloud.
   Cloud labelling is opt-in.
4. **Every signal is labelled with how it was produced** (`rules` / `on_device` / `in_cloud`), and the UI shows it.
5. **One brain, many sensors.** Platform-specific code lives only in *sensors* and the *on-device model binding*.
   Tactics, prompts, weights, schemas and scoring are shared contracts.

## 2. Layers

```
 SENSORS (per platform)          ROUTER (per device)                  HOUSEHOLD (Firestore)        GUARDIAN
 ───────────────────────         ─────────────────────────            ─────────────────────        ──────────
 Chrome ext: Gmail,              1 rules prefilter   (always, instant) events (no text)            web dashboard
   Messenger, WhatsApp Web  ──►  2 on-device Nano    (when allowed)  ─► contacts (hashed)      ──►  push alerts
 Android: notification           3 risk engine       (deterministic)    links (cross-channel)       check-in drafts
   listener, share-to-Longcon    4 cloud judge       (escalations only, alerts
 iOS (roadmap): share ext,          redacted + Google Search)
   SMS filter
```

### 2.1 Sensors
| Platform | Sensor | Sees | Notes |
|---|---|---|---|
| Web (Chrome extension) | DOM adapters for Gmail, Facebook Messenger, WhatsApp Web | Both sides of open conversations | Adapters are isolated + fixture-tested (DOMs change) |
| Android | `NotificationListenerService` | Incoming messages from WhatsApp, SMS, Messenger, Telegram, Gmail (via `MessagingStyle` extras) | User grants notification access in onboarding. Doesn't see outgoing messages or muted chats. Ask for a battery-optimisation exemption (Samsung) |
| Android | Share target (`ACTION_SEND`) | Any text or a **screenshot** the user shares to Longcon | Opens Longcon in the foreground → Nano runs instantly (text + Bitmap) |
| iOS (roadmap) | Share extension, `ILMessageFilterExtension` (unknown-sender SMS) | Only what the user shares, plus SMS from unknown senders | iOS sandbox forbids reading other apps. Apple Foundation Models via Firebase AI Logic. Needs a Mac + Apple-Intelligence iPhone, so not in the Nov 30 build |

### 2.2 Router: the privacy ladder
| Rung | Route | Runs when | Produces |
|---|---|---|---|
| 1 | `rules` | Always, instantly, in the background | Low-confidence tactic hits from keyword/regex patterns (USDT, gift card, "don't tell", "add me on Telegram", OTP…). Provisional score |
| 2 | `on_device` | **Web:** whenever the side panel/page is open. **Android:** only while Longcon is the top foreground app (AICore rule) | Full tactic tags (structured JSON) + extracted handles |
| 3 | risk engine | After every rung | Score, level, stage of the scam arc, escalate flag |
| 4 | `in_cloud` | Score ≥ escalation threshold (or explicit user/guardian request) | Verdict + evidence + verification questions, using Google Search grounding on a **redacted summary** |

### 2.3 Android background design (settled)
On-device Gemini Nano on Android runs **only when the app is the top foreground app**. Background
workers and foreground services get `BACKGROUND_USE_BLOCKED`. So:

1. **Capture (background, always):** the notification listener stores each incoming message, encrypted
   (Room + Android Keystore), and runs **rung 1 rules** immediately. No network, no model.
2. **Tap to check:** if the rules score for a contact jumps past the *check threshold*, Longcon posts one
   notification: **"A message from Mark looks like a scam pattern. Tap to check privately."** Tapping
   opens Longcon (now foreground) → Nano tags that message plus the queued backlog for that contact.
3. **Opportunistic drain:** any time Longcon is in the foreground (opened, tapped, share-to-Longcon,
   daily check-in screen), Nano drains the backlog in priority order (highest rules score first),
   with exponential backoff on `BUSY`/quota errors. The UI says "47 messages checked privately on this phone".
4. **If nobody taps:** a contact with a high *rules-only* score past a time limit (e.g. 6h) appears to the
   guardian as an **unconfirmed pattern**, clearly labelled `rules`. No cloud call is needed for that.
5. **Cloud stays escalation-only:** the cloud judge (rung 4) is a normal network call and works from the
   background, but it only ever receives the redacted pattern summary of an escalated contact.

Result: the phone is always watching (rules), the AI model runs at the moments that matter, and nothing
private is uploaded. The limits page states plainly that Nano on Android needs Longcon to be open.

### 2.4 Household (cross-device, cross-channel)
Firestore. **No message text, no evidence quotes, no raw identifiers.**

```
households/{hid}
  members/{uid}        role: protected | guardian, platform, deviceName, fcmToken
  contacts/{cHash}     displayHint, channels[], score, level, stageReached, lastSeenAt, routes{rules,on_device,in_cloud}
  events/{eid}         cHash, tactic, stage, sentAt, channel, deviceId, route
  links/{lid}          fromHash, toHash, via: "move_off_platform" | "manual"
  alerts/{aid}         cHash, level, verdict (redacted summary), createdAt, ackBy
```

- **Contact hashing:** `cHash = HMAC-SHA256(householdSecret, normalise(handle))`. The secret is shared
  **device-to-device at pairing (QR code)** and never stored in Firestore, so the server can't brute-force
  phone numbers out of the hashes.
- **Cross-channel linking:** when the tagger sees `move_off_platform`, it also extracts the new handle
  ("add me on Telegram @eng_mark"). The handle is hashed into a `link`, so when @eng_mark messages the
  phone, the timeline continues from the laptop: *"Day 9: moved you from email (laptop) to Telegram (phone)."*
- **Pairing:** the laptop shows a QR code {householdId, one-time invite, householdSecret}; the phone scans it.
  The guardian joins the same way.

### 2.5 Guardian
- Web dashboard: per-contact timelines across devices and channels, alerts, route badges. Pattern only, never messages.
- Push alerts via FCM (Cloud Function on `alerts` create).
- Nano drafts a gentle check-in message for the guardian to send to their parent.

### 2.6 Shared contracts (`/contracts`)
- `tactics.json`: ids, stages, weights, definitions, and the rules-prefilter patterns.
- `tag.schema.json`: the tagger output schema (Nano `responseConstraint` / cloud `responseJsonSchema`).
- `event.schema.json`, `contact.schema.json`: household documents.
- `vectors/*.json`: test cases (tagged message sequences → expected score/level/stage). **The TypeScript
  and Kotlin risk engines must both pass them**, which keeps the platforms identical.
- **Remote Config** serves `tactics`, weights, thresholds and prompts at runtime (the bundled contracts are
  the defaults), so both platforms are tuned from one place.

## 3. Firebase products
| Product | Use |
|---|---|
| AI Logic | Web: Chrome Nano (`ONLY_ON_DEVICE`, or `PREFER_ON_DEVICE` with consent). Android: AICore Nano, same modes. Cloud judge: `ONLY_IN_CLOUD` + Google Search grounding |
| App Check | Web: reCAPTCHA v3. Extension + sideloaded Android APK: debug provider (allowed by contest rules) |
| Auth | Anonymous auth per device, bound to a household at pairing |
| Firestore | Household signals (schema above) + security rules (members only) |
| Remote Config | Tactics, weights, thresholds, prompts |
| Cloud Functions + FCM | Alert fan-out to guardians; invite redemption. **Needs the Blaze plan**: set a $1 budget alert |
| Hosting | Landing page, demo inbox, guardian dashboard |

## 4. Known limits (published on the limits page)
- Android Nano runs only while Longcon is open; background coverage is rules-based until then.
- The notification listener sees incoming messages only, and nothing from muted or notification-disabled chats.
- On-device models: English validated; ~4k-token (Android) / ~9k-token (Chrome) request limits, so tagging is per message.
- Supported hardware only: desktop Chrome with Nano; recent flagship Android phones with AICore.
- iOS is designed for (share extension + unknown-sender SMS) but not built for the hackathon.
