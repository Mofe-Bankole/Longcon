# Longcon design

## The idea: the long view
A scam is invisible in the short view (one message) and obvious in the long view (three weeks on one line).
Longcon's whole interface is **the long view**: a calm friend who has read the entire conversation and
can show you the shape of it.

**Signature element: the Arc.** A four-segment track: *Getting close → Cutting you off → The story →
Asking for money*. It fills in as warning signs appear, with day markers ("Day 4", "Day 21"). It appears
everywhere: the side panel, the Android notification, the guardian dashboard, the landing hero, the video's
title card and its closing frame. One motif, repeated, is what made useLeash feel designed rather than assembled
(their newspaper masthead ran through copy, captions and sections). The Arc is ours.

## Who we design for
| | Protected person | Guardian |
|---|---|---|
| Who | Retiree, 65+, any literacy, maybe low vision | Their adult child, 40–55, busy, worried |
| Device | Laptop (Gmail, Messenger), Android phone | Phone + web dashboard |
| Wants | Not to feel stupid. A straight answer | To know early, without reading Mum's messages |
| Design answer | One plain sentence, big type, read aloud, one action | Pattern only, route badges, a ready-to-send check-in |

## Principles
1. **Calm until it matters.** No red, no alarms below *danger*. Fear makes people defensive ("Mark isn't like that").
   Warnings are framed as *questions to ask*, never accusations.
2. **One sentence, one action.** Every verdict is a single plain sentence plus one primary button
   ("Ask him for a video call", "Call Sarah"). Detail is one tap away, never in the way.
3. **Never blame.** "These are signs scammers use" and never "you are being scammed". The person keeps their dignity and their choice.
4. **Show the proof, keep the privacy.** Each sign shows its quote, *on this device only*. The guardian sees the sign, never the quote.
5. **Say where it ran.** Every result carries a route badge. Privacy you can see is privacy you can trust.
6. **Never make anyone wait on a model.** See *Latency* below.

## Plain words (protected-person UI)
| Never say | Say |
|---|---|
| tactic, risk score, escalate | warning sign, how worried we are, get a second opinion |
| on-device inference | checked privately on this computer |
| in_cloud (tagging, consented) | checked by Google, with your permission |
| cloud judge (grounding) | second opinion from Google (only the pattern was sent, not your messages) |
| rules | quick check |
| love_bombing | *the `plain` field in `contracts/tactics.json`* ("Very loving words, very soon") |

Levels for people: **clear** "Nothing worrying" · **watch** "Keep an eye on this" · **warning** "Some warning signs" ·
**danger** "This looks like a scam". The dashboard may show the numeric score. The protected person never sees it.

## Latency: what the person sees
| Moment | Budget | What happens |
|---|---|---|
| Message appears | **< 16 ms** | Quick check (rules) runs; the Arc updates with *provisional* segments (dashed outline) |
| Nano refines | 0.3–3 s per batch (VM: slower; measured) | Segments turn solid; the badge changes to "Checked privately". No spinner, just a subtle shimmer on the pending item |
| First open of the panel | hidden | `warmUp()` loads Nano while the person reads |
| Backlog (first install, 3 weeks of mail) | background | "Checking 12 of 40 privately…" bar; riskiest contact first |
| Second opinion (cloud judge) | 3–8 s | Three-step progress with plain labels: "Removing your private details → Asking Google → Writing the answer". The person can keep reading |

Engineering behind this lives in `packages/core/src/router.ts`. Rules come first, then batched Nano calls
(the SDK opens a new session per call, so batching is the biggest saving). Calls run one at a time, riskiest
contact first, and the cache means a message is never labelled twice. `LatencyStats` reports p50/p95 per route, which feeds the benchmark page.

## Visual system
Tokens live in `packages/ui/tokens.css` and are the only source of colour, type and spacing.

- **Paper and ink.** Warm off-white paper, near-black ink, hairline rules. It should feel like a trustworthy letter, not a security dashboard.
- **Type.** **Atkinson Hyperlegible Next** for all UI. It was designed by the Braille Institute for low-vision readers,
  and the write-up says so. **Newsreader** for display headings and the verdict sentence. Fonts are bundled locally, because extension pages can't rely on remote assets.
- **Sizes.** Protected-person UI: 20px base, 28px verdict, 48px minimum tap targets. Guardian/dashboard: 16px base.
- **Stage ramp** (the Arc): sage → ochre → burnt orange → deep red. Each segment always pairs colour with its
  label and an icon, so the Arc works in greyscale and for colour-blind users.
- **Route badges:** a lock icon for "Checked privately", a cloud icon for "Checked by Google, with your permission" (tagging) or "Second opinion" (judge: pattern only), and a lightning bolt for "Quick check".
- **Motion:** only to explain. An Arc segment fills left to right, and provisional segments solidify. `prefers-reduced-motion` turns it all off.
- Light and dark themes. The side panel follows Chrome's theme.

## Screens
1. **Side panel (Chrome), protected person.** The contact you're reading → the Arc → one verdict sentence →
   up to 3 warning signs (plain label + quote + day) → primary action → "Read this to me" (speechSynthesis).
   Footer: route badge + "47 messages checked privately on this computer".
2. **Second opinion card.** After escalation: the verdict, *what we checked* (e.g. "'Crypto Prime Markets' has no
   registration with the regulators we searched"), and **3 questions to ask him**, written to be read aloud or sent.
3. **Android: tap to check.** The notification is the Arc as a compact image + "A message from Mark looks like a
   pattern scammers use. Tap to check privately." It opens to the same layout as the side panel.
4. **Guardian dashboard (web).** A contact list sorted by worry → per-contact Arc *across devices and channels*
   ("Day 9: moved from email (laptop) to Telegram (phone)") → route badges → **draft a gentle check-in** (Nano-written,
   editable). Never shows message text.
5. **Demo inbox (hosted).** A believable Gmail-like inbox with Margaret's 3-week oil-rig conversation, so judges
   can see it without installing anything. Cloud labelling is behind an explicit consent switch when Nano is absent.
6. **Landing + limits + evidence.** Hero = the Arc animating over a real conversation. Sections: the problem (with sourced
   numbers), how hybrid works (the ladder), privacy (what leaves the device, exactly), benchmark, limits, and an
   **"Evidence for judges"** table mapping each claim to a file, test, or recording (a useLeash docs move worth copying).

## Lessons taken from useLeash (and where we beat it)
- Copy: one strong concept carried everywhere (the Arc, like their masthead).
- Copy: a "Constraints" page and an "Evidence for reviewers" table. Judges reward honesty they can check.
- Copy: honest platform status (iOS "designed, not built", Android "Nano needs Longcon open").
- Beat: their privacy claims are absolute while the fine print qualifies them. Ours are exact: the privacy page lists
  every byte that leaves a device (redacted summary to the judge; hashes and tactic ids to Firestore) and links the code.
- Beat: their pitch is abstract ("private exocortex"). Ours has a person in it: Margaret, 71, Day 1 to Day 21.
