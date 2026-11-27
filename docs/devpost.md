# Devpost write-up (draft)

> Fill the **[N]** values from Moses's benchmark run before submitting. Never round in our favour.

**Tagline:** Catch the scams that take weeks, without your chats leaving your device.

## Inspiration
Long cons, like romance scams, "pig-butchering" crypto scams and fake recruiters, don't look dangerous in any single message.
They build up over weeks: affection, then "let's move to Telegram", then "don't tell your children", then a crisis, then
"send it as USDT". By the time a message *looks* like a scam, the victim trusts the scammer. Spam filters judge
one message at a time, so they miss the pattern. And reading someone's whole message history in the cloud to find it
is its own privacy disaster. We wanted something that reads the long game **on the device**.

## What it does
Longcon watches a conversation as it unfolds and maps it onto the **Arc** of a long con: *getting close → cutting you
off → the story → asking for money*. Every message gets an instant quick check, then Gemini Nano labels it privately
on the device for 12 warning signs. A tested risk engine scores the progression and tells the person, in big type
and plain words (and aloud, if they want), what's going on and what to do: *"Please don't send money, gift cards or codes. Talk to
someone you trust first."*

When a conversation is flagged, the person can ask for a **second opinion**. Gemini in the cloud receives only a
redacted list of the warning signs, never the conversation. It returns a verdict and **three questions a genuine
person could answer and a scammer can't**. The card shows *exactly* what was sent.

In our demo, Margaret (71) gets three weeks of messages from "Mark", an oil-rig engineer. Longcon warned her on
**day [W]**, **[N] days before** he first asked for money. Across three genuine look-alike conversations (a real
long-distance partner, a real recruiter, a sister borrowing money) it raised **[no] false alarms**.

## How we built it: hybrid by design
- **Firebase AI Logic hybrid inference** (`firebase/ai`):
  - The tagger uses `InferenceMode.ONLY_ON_DEVICE` with a JSON `responseConstraint`, so Nano returns structured tactic labels.
  - `PREFER_ON_DEVICE` is used **only after explicit consent**. There's no silent fallback.
  - Every result is labelled with its `inferenceSource`, and the UI shows it on every sign.
- **Latency engineering:**
  - The SDK opens a fresh Nano session per call, so we **batch 6 messages per call**.
  - We warm the model up when the page opens and cache labels per message.
  - The model queue runs the riskiest contact first.
  - The instant rules verdict means the person never waits on a model.
- **The cloud judge:** Gemini with Google Search grounding, on a redacted summary.
  - Redaction removes names, emails, phone and account numbers, and keeps what's checkable, like company names and domains.
  - On the free plan grounding has no quota, so it falls back to Gemini alone and the card says so.
- **App Check:** reCAPTCHA Enterprise on the web; the debug provider for the extension and the APK.
- **One brain, two platforms:**
  - The tactics, keyword rules and scoring settings live in `contracts/tactics.json`.
  - Golden test vectors (risk scores, rules, HMAC contact hashes) are run by **both** the TypeScript core and a Kotlin port in CI, so web and Android score identically.
- **Design for a 65+ reader:**
  - Atkinson Hyperlegible (designed for low-vision readers) at 20px.
  - Plain words: "warning sign", not "tactic".
  - Calm until it matters, and never blaming.
  - One sentence, one action, read aloud on request. Every colour pair passes WCAG AA in light and dark.

## Measured
| Route | F1 | Typical latency per message |
|---|---|---|
| Quick check (rules) | [ ] | < 1 ms |
| Gemini Nano on device (6 per call) | [ ] | [ ] |
| Gemini Nano on device (1 per call) | [ ] | [ ] |
| Gemini in the cloud (6 per call) | [ ] | [ ] |

(RTX 2070, Chrome [version], Windows 11. Raw results in `bench/`.)

## Challenges
- **No team member owned a Nano-capable machine.**
  - Google Cloud asked for a prepayment from Nigeria, so we recruited a friend's RTX 2070 PC as the demo machine.
  - We built a bundle script and a benchmark page so one visit to that PC produced every measurement.
- **Calibration.** Our first engine flagged a sister asking to borrow £300 as a warning. We added rules that encode what a long con *is*:
  - One kind of sign alone is at most "keep an eye on this".
  - "Danger" needs a request for money or codes.
  - "Danger" also needs a model-confirmed sign, so keywords alone can never call something a scam.
- **Being exactly honest about privacy.** Our first copy said the second opinion "never sends your messages". It sends
  short redacted quotes of the flagged lines, so we changed the copy and added a "What Google saw (exactly)" view.

## What we learned
On-device AI changes what's acceptable to build. Reading weeks of someone's private messages is only OK if it never
leaves their device, and hybrid inference lets the cloud do what it's good at (search, bigger models) on the
smallest, most redacted input possible.

## What's next
- **Guardian mode:** an adult child gets an alert with the pattern only, never the messages. We'll use Firestore with HMAC-hashed contacts and pairing by QR code; the design and Kotlin hashing are already done.
- **Android:**
  - A notification listener with "Tap to check privately", since Android only runs Nano while Longcon is open.
  - A "Share to Longcon" target for screenshots, using Nano's image input.
- Chrome extension adapters for Gmail, WhatsApp Web and Messenger, iOS through Apple Foundation Models, and more languages.

## Built with
Firebase AI Logic · Gemini Nano · Gemini · Firebase App Check (reCAPTCHA Enterprise) · Firebase Hosting · TypeScript · Vite · Kotlin · Jetpack Compose · GitHub Actions
