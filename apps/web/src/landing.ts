import { rulesTag, STAGE_LABELS, TACTICS, verdictFor, scoreContact, type TacticId, type TaggedMessage } from '@longcon/core';
import { renderArc } from '@longcon/ui';
import { CONVERSATIONS } from './corpus';
import { esc } from './panel';

/**
 * The front door. Hero = "the long view": Margaret's real demo lines appear at their days while the
 * Arc fills, ending on the verdict. Lines and days come from the corpus, so they match the demo exactly.
 */
const PICK: TacticId[] = ['unverifiable_persona', 'love_bombing', 'move_off_platform', 'secrecy_request', 'investment_pitch', 'payment_request', 'risky_payment_method'];
const DAY = 86_400_000;
const REPO = 'https://github.com/Mofe-Bankole/Longcon';

interface Beat { day: number; text: string; tactic: TacticId; tagged: TaggedMessage }

function beats(): Beat[] {
  const conv = CONVERSATIONS.find((c) => c.id === 'romance_oil_rig')!;
  const t0 = conv.messages[0]!.sentAt;
  const out: Beat[] = [];
  for (const tactic of PICK) {
    const m = conv.messages.find((x) => !x.fromUser && (conv.expected.get(x.id) ?? []).includes(tactic));
    if (!m) continue;
    out.push({
      day: Math.floor((m.sentAt - t0) / DAY),
      text: shorten(m.text, tactic),
      tactic,
      tagged: { messageId: m.id, contactId: conv.id, sentAt: m.sentAt, hits: [{ tactic, evidence: m.text }], route: 'on_device', latencyMs: 0 },
    });
  }
  return out.sort((a, b) => a.tagged.sentAt - b.tagged.sentAt);
}

/** The sentence that carries the sign (by the quick-check patterns), else the first one; max ~95 chars. */
function shorten(t: string, tactic: TacticId): string {
  const s = (t.match(/[^.!?]+[.!?]*/g) ?? [t]).map((x) => x.trim()).filter(Boolean);
  let out = s.find((x) => rulesTag(x).some((h) => h.tactic === tactic)) ?? s[0]!;
  const i = s.indexOf(out);
  if (out.length < 40 && s[i + 1]) out += ' ' + s[i + 1];
  return out.length > 95 ? out.slice(0, 92).trimEnd() + '…' : out;
}

export function mountLanding(root: HTMLElement): void {
  root.innerHTML = `
  <div class="landing">
    <header class="l-top">
      <a class="brand" href="#/"><span class="brand__mark"></span>Longcon</a>
      <nav><a href="#/about">How it works</a><a href="${REPO}">GitHub</a><a class="btn btn--primary btn--small" href="#/demo">Try the demo</a></nav>
    </header>

    <section class="l-hero">
      <div class="l-hero__copy">
        <p class="l-kicker">On-device scam protection · Gemini Nano</p>
        <h1>Catch the scams that take weeks, without your chats leaving your device.</h1>
        <p class="l-lead">One message looks harmless. The pattern takes weeks: affection, then "let's move to Telegram",
          then "don't tell your children", then "send it as USDT". Longcon reads the long game privately, on your
          own computer, and tells you in plain words before the money goes.</p>
        <div class="l-ctas">
          <a class="btn btn--primary" href="#/demo">Watch it read three weeks</a>
          <a class="btn" href="#/demo/own">Check your own conversation</a>
        </div>
        <p class="l-fine">Free · no sign-up · works best in Chrome with Gemini Nano</p>
      </div>
      <div class="l-hero__demo" aria-label="Margaret's conversation with Mark, summarised over three weeks">
        <div class="l-card">
          <div class="l-card__head"><span class="avatar">M</span><div><b>Mark</b><br><span class="muted">Email → Telegram · 3 weeks</span></div>
            <button class="l-replay" aria-label="Replay">↻</button></div>
          <div class="l-card__arc"></div>
          <ol class="l-lines"></ol>
          <div class="l-verdict" hidden></div>
        </div>
      </div>
    </section>

    <section class="l-stat">
      <p class="l-stat__num">$4.885 billion</p>
      <p>lost to fraud by people aged 60 and over in 2024, up 43% in a year, in reports to the FBI alone.
        Investment scams took $6.57 billion across all ages.</p>
      <p class="muted small">Source: <a href="https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf">FBI Internet Crime Complaint Center, 2024 Internet Crime Report</a>.</p>
    </section>

    <section class="l-section">
      <h2>How Longcon reads the long game</h2>
      <div class="l-steps">
        <div><span class="l-num">1</span><h3>Quick check</h3><p>Every message, instantly, on your device. Never enough on its own to call something a scam.</p></div>
        <div><span class="l-num">2</span><h3>Gemini Nano, on your device</h3><p>Looks for 12 warning signs in every message, privately, through Firebase AI Logic. Nothing is uploaded.</p></div>
        <div><span class="l-num">3</span><h3>The Arc</h3><p>Getting close → cutting you off → the story → asking for money. The pattern is what matters, so that's what Longcon scores.</p></div>
        <div><span class="l-num">4</span><h3>A second opinion</h3><p>Only if you ask. Gemini in the cloud sees the warning signs, with names and numbers removed. Never the conversation.</p></div>
      </div>
      <p><a href="#/about">The details, the limits, and the evidence →</a></p>
    </section>

    <section class="l-section l-split">
      <div>
        <h2>Private by design, not by promise</h2>
        <ul class="l-checks">
          <li><b>On your device by default.</b> Messages are checked by Gemini Nano on your own computer.</li>
          <li><b>No silent fallback.</b> If your computer can't run Nano, Longcon asks before anything goes to Google.</li>
          <li><b>You can see what was sent.</b> Every second opinion shows exactly what Google received.</li>
          <li><b>Every result says where it ran:</b> checked privately, checked by Google with your permission, or quick check.</li>
        </ul>
      </div>
      <div>
        <h2>Made for the people scammers target</h2>
        <ul class="l-checks">
          <li><b>Plain words.</b> "Asked you to keep it secret", not "isolation tactic".</li>
          <li><b>Big, clear type.</b> Atkinson Hyperlegible, designed for low-vision readers.</li>
          <li><b>Read aloud.</b> One tap, and Longcon says it out loud.</li>
          <li><b>Never blaming.</b> "These are signs scammers use", and one clear thing to do next.</li>
        </ul>
      </div>
    </section>

    <section class="l-cta">
      <h2>See it for yourself</h2>
      <p>Replay six conversations, three scams and three genuine ones, or check one of your own.</p>
      <div class="l-ctas l-ctas--center">
        <a class="btn btn--primary" href="#/demo">Try the demo</a>
        <a class="btn" href="#/demo/own">Check your own conversation</a>
      </div>
    </section>

    <footer class="l-foot">
      <span><span class="brand__mark"></span> Longcon · built for #BuildHybridAI 2026 with Firebase AI Logic and Gemini Nano</span>
      <span><a href="#/about">How it works &amp; limits</a> · <a href="#/bench">Benchmark</a> · <a href="${REPO}">GitHub</a> · Apache-2.0</span>
    </footer>
  </div>`;

  play(root);
  root.querySelector<HTMLButtonElement>('.l-replay')!.onclick = () => play(root);
}

let timers: number[] = [];

function play(root: HTMLElement): void {
  timers.forEach(clearTimeout);
  timers = [];
  const bs = beats();
  const arcEl = root.querySelector<HTMLElement>('.l-card__arc')!;
  const list = root.querySelector<HTMLElement>('.l-lines')!;
  const verdict = root.querySelector<HTMLElement>('.l-verdict')!;
  list.replaceChildren();
  verdict.hidden = true;
  renderArc({ timeline: [] }, arcEl);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = reduced ? 0 : 1100;

  bs.forEach((b, i) => {
    timers.push(
      window.setTimeout(() => {
        const li = document.createElement('li');
        li.className = `l-line stage-${TACTICS[b.tactic].stage}`;
        li.innerHTML = `<span class="l-line__day">Day ${b.day + 1}</span><span class="l-line__text">“${esc(b.text)}”</span>
          <span class="sign-chip stage-${TACTICS[b.tactic].stage}">${esc(TACTICS[b.tactic].plain)}</span>`;
        list.append(li);
        const risk = scoreContact('romance_oil_rig', bs.slice(0, i + 1).map((x) => x.tagged));
        renderArc(risk, arcEl);
        if (i === bs.length - 1) {
          timers.push(
            window.setTimeout(() => {
              const v = verdictFor(risk, 'Mark');
              verdict.className = `l-verdict level-${v.level}`;
              verdict.innerHTML = `<b>${esc(v.title)}</b><span>${esc(v.action)}</span>`;
              verdict.hidden = false;
            }, step * 0.8),
          );
        }
      }, 400 + i * step),
    );
  });
  arcEl.setAttribute('title', Object.values(STAGE_LABELS).join(' → '));
}
