# Video: script and shot list

**Hard cap 3:00** (judges only evaluate the first 3 minutes). Target **2:50**. Every second shows the real product.
Narration: Mofe. Recording: Moses (web, on the Nano PC) + Stephen (Android). Edit: Stephen.

## Script

| Time | Picture | Narration (Mofe) |
|---|---|---|
| 0:00–0:12 | **S1** Title: the Arc animating empty → full. Text: *"Margaret, 71. Day 1."* | "Margaret is seventy-one. On a Monday in September she got a kind email from a man called Mark." |
| 0:12–0:30 | **S2** Thread scrolling: day 1 hello → day 5 "Add me on Telegram" → day 18 "Send it as USDT". | "Two weeks later he was asking her for fifteen hundred dollars, in crypto. None of his messages looked dangerous on its own. The danger was the pattern, and the pattern takes weeks. That's a long con." |
| 0:30–0:40 | **S3** The Longcon demo, "Private model ready on this computer" pill in focus. | "Longcon reads the long game, and it does it on your own computer, with Gemini Nano through Firebase AI Logic." |
| 0:40–1:25 | **S4** Press **Play** on Margaret & Mark. Signs appear under messages (dashed → solid "Checked privately"). The Arc fills: Getting close (day 1) → Cutting you off (day 5, "Moved from Email to Telegram" marker) → The story (day 11). Panel turns **Some warning signs**. Footer: "checked privately on this computer · typically N ms". | "Every message is checked twice. An instant keyword check, then Gemini Nano, privately, on the device. Day one: an oil rig engineer she can't verify, and very loving words, very soon. Day five: he moves her to Telegram. Day seven: don't tell your children. By day W, more than a week before anyone asks for a cent, Longcon is already warning her." |
| 1:25–1:40 | **S5** Money ask arrives → panel turns **This looks like a scam**. Click **Read this to me** (audio audible). | "When he asks for money, Longcon says it plainly, in big type, and reads it aloud. No jargon, no blame." |
| 1:40–2:05 | **S6** Click **Get a second opinion** → three steps → card: verdict, claims, **Ask Mark** questions. Open **What Google saw (exactly)**. | "Only now does anything go to the cloud: not the conversation, just the warning signs, with names and numbers removed. And you can see exactly what was sent. Gemini gives a second opinion, and three questions a real person could answer and a scammer can't." |
| 2:05–2:20 | **S7** Diagram: the privacy ladder (rules → Nano → risk engine → cloud judge). Then a no-Nano laptop: "This computer can't run the private model" + consent box. | "That's hybrid AI by design: on-device for every message, cloud only for escalations. And no silent fallback. If a computer can't run Nano, Longcon asks before anything leaves it." |
| 2:20–2:35 | **S8** Benchmark page results table (on-device vs cloud vs keywords), highlight: *"warned on day N; money asked on day 16"* and *"genuine conversations: no false alarms"*. | "We tested it on six labelled conversations, three scams and three genuine look-alikes. Nano warned Margaret N days before the first request for money, with no false alarms on the genuine ones." |
| 2:35–2:50 | **S9** Android phone: notification "A message from Mark looks like a scam pattern. Tap to check privately." → tap → the Arc on the phone. | "Scams don't stay on one device, so neither does Longcon. On Android it watches incoming messages and checks them with Nano the moment you open it, using the same tested rules as the web." |
| 2:50–3:00 | **S10** End card: the Arc + **Longcon** + `longcon.web.app` + "Firebase AI Logic · Gemini Nano". | "Longcon. Catch the long con, before the money goes." |

Replace **W** (the day the demo panel first says *Some warning signs* on Moses's PC) and **N** (days of warning before the money ask, from the benchmark) with real numbers. If W isn't more than a week before day 16, change that sentence to match. Never round in our favour. If Android footage isn't ready, S9 becomes the Kotlin
test run in CI + "Android: in progress" (say so honestly) and S8 gets the extra 15 s.

## Shot list for Moses (Nano PC)

**Setup for every take:**
- Use the Longcon Chrome profile and set the window to **1920×1080**. Hide the bookmarks bar (Ctrl+Shift+B) and close all other tabs.
- Keep zoom at 100% (use 110% if the text looks small on playback).
- Turn notifications off (Focus assist on). The model pill must say **Private model ready on this computer**.
- Record with Win+Alt+R, or OBS at 1080p/30fps if available.
- Before each take, click **Reset** in the conversation. Keep the mouse still unless you're clicking.

| Shot | URL | Action | Length to capture |
|---|---|---|---|
| S2 | `longcon.web.app/?c=romance_oil_rig&all=1` | Slowly scroll the thread from top to bottom with the mouse wheel | 40 s |
| S3 | `longcon.web.app/#/demo` | Hold on the full page for 5 s, then hover the model pill | 10 s |
| S4 | `longcon.web.app/#/demo` (Margaret & Mark) | **Reset** → **Play** at *Speed: normal*. Let it run to day 16 without touching anything | the whole run (~50 s) |
| S5 | continue S4 | When the panel says *This looks like a scam*, click **Read this to me**. **Record system audio** | 20 s |
| S6 | continue S5 | Scroll the panel down → **Get a second opinion** → wait → scroll through the card → open **What Google saw (exactly)** and scroll it | 40 s |
| S7b | any laptop **without** Nano (e.g. Mofe's) | Show the pill "This computer can't run the private model" and tick "Let Google check messages" | 10 s |
| S8 | `longcon.web.app/#/bench` | Run the benchmark (everything ticked except Cloud the first time, then a second run with Cloud ticked). Record only the finished results tables, scrolled slowly | 20 s |
| S1/S10 | `longcon.web.app/` (landing) | Record the hero card animating (click ↻ to replay), and the full page scrolled slowly for the end card | 20 s |
| Proof | `chrome://on-device-internals` | Show the model status (for the write-up and a 1 s flash in S3) | 10 s |

Also take 2–3 screenshots of each panel state (warning, scam, second opinion) at full resolution. These are for Devpost.

## Shot list for Stephen (Android)
- S9: a screen recording on the phone (Android's built-in recorder) of the notification arriving → tap → the app opening on Mark's contact, plus 5 s on the contact list.
- A 10 s clip of a CI run passing `:core:test` (GitHub Actions page).

## Edit notes
- Cut the waits, never fake a result. When Nano latency appears on screen, keep the real number.
- Captions on (burned in), plain font, bottom third. Keep music very low or leave it out.
- Upload to YouTube **Unlisted** first, check it while logged out, then set it to Public before submitting.
