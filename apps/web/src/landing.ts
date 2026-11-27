import { rulesTag, scoreContact, TACTICS, verdictFor, type TacticId, type TaggedMessage } from '@longcon/core';
import { renderArc } from '@longcon/ui';
import { CONVERSATIONS } from './corpus';
import { esc } from './panel';
import './landing.css';

/**
 * The front door, built around one idea: the long view.
 * Every line in the hero timeline is a real message from the demo, at its real day.
 */
const PICK: TacticId[] = ['unverifiable_persona', 'love_bombing', 'move_off_platform', 'secrecy_request', 'investment_pitch', 'payment_request', 'risky_payment_method'];
const DAY = 86_400_000;
const SPAN = 21;
const REPO = 'https://github.com/Mofe-Bankole/Longcon';

interface Beat { day: number; text: string; tactic: TacticId; tagged: TaggedMessage }

function story(): { beats: Beat[]; start: TaggedMessage } {
  const conv = CONVERSATIONS.find((c) => c.id === 'romance_oil_rig')!;
  const first = conv.messages.find((x) => !x.fromUser)!;
  const beats: Beat[] = [];
  for (const tactic of PICK) {
    const m = conv.messages.find((x) => !x.fromUser && (conv.expected.get(x.id) ?? []).includes(tactic));
    if (!m) continue;
    beats.push({
      day: Math.floor((m.sentAt - first.sentAt) / DAY),
      text: sentence(m.text, tactic),
      tactic,
      tagged: { messageId: m.id, contactId: conv.id, sentAt: m.sentAt, hits: [{ tactic, evidence: m.text }], route: 'on_device', latencyMs: 0 },
    });
  }
  beats.sort((a, b) => a.tagged.sentAt - b.tagged.sentAt);
  return { beats, start: { messageId: first.id, contactId: conv.id, sentAt: first.sentAt, hits: [], route: 'on_device', latencyMs: 0 } };
}

/** The sentence that carries the sign (by the quick-check patterns), else the first; ≤ 90 chars. */
function sentence(t: string, tactic: TacticId): string {
  const s = (t.match(/[^.!?]+[.!?]*/g) ?? [t]).map((x) => x.trim()).filter(Boolean);
  let out = s.find((x) => rulesTag(x).some((h) => h.tactic === tactic)) ?? s[0]!;
  const i = s.indexOf(out);
  if (out.length < 36 && s[i + 1]) out += ' ' + s[i + 1];
  return out.length > 90 ? out.slice(0, 87).trimEnd() + '…' : out;
}

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const CLOUD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

export function mountLanding(root: HTMLElement): void {
  const { beats, start } = story();
  const final = scoreContact('romance_oil_rig', [start, ...beats.map((b) => b.tagged)]);
  const v = verdictFor(final, 'Mark');

  root.innerHTML = `
  <div class="ld">
    <header class="ld-nav">
      <a class="brand" href="#/"><span class="brand__mark"></span>Longcon</a>
      <nav><a href="#/about">How it works</a><a href="${REPO}">GitHub</a><a class="btn btn--primary btn--small" href="#/demo">Try the demo</a></nav>
    </header>

    <section class="ld-hero">
      <p class="ld-pill"><span class="ld-pill__dot"></span>Runs on your device with Gemini Nano</p>
      <h1>The scams that take <em>weeks</em>,<br>caught before the money&nbsp;goes.</h1>
      <p class="ld-sub">One message looks harmless. The pattern takes weeks. Longcon reads the whole conversation,
        privately, on your own computer, and tells you in plain words when it looks like a scam.</p>
      <div class="ld-ctas">
        <a class="btn btn--primary btn--lg" href="#/demo">Watch it read three weeks</a>
        <a class="btn btn--lg" href="#/demo/own">Check your own conversation</a>
      </div>
    </section>

    <section class="ld-long reveal" aria-label="Margaret and Mark, three weeks on one line">
      <div class="lv">
        <div class="lv__legend"></div>
        <div class="lv__stage">
          <div class="lv__track"><div class="lv__fill"></div><div class="lv__head"></div></div>
          <div class="lv__ticks">${[1, 7, 14, 21].map((d) => `<span style="left:${((d - 1) / (SPAN - 1)) * 100}%">Day ${d}</span>`).join('')}</div>
          ${beats
            .map((b, i) => {
              const x = (b.day / (SPAN - 1)) * 100;
              const side = i % 2 === 0 ? 'up' : 'down';
              const anchor = x > 72 ? 'end' : 'start';
              return `<div class="lv__beat lv__beat--${side} lv__beat--${anchor} stage-${TACTICS[b.tactic].stage}" style="left:${x}%" data-i="${i}">
                <span class="lv__dot"></span><span class="lv__stem"></span>
                <div class="lv__card"><span class="lv__day">Day ${b.day + 1}</span>
                  <p>“${esc(b.text)}”</p><span class="sign-chip stage-${TACTICS[b.tactic].stage}">${esc(TACTICS[b.tactic].plain)}</span></div>
              </div>`;
            })
            .join('')}
        </div>
        <div class="lv__end">
          <div class="lv__verdict level-${v.level}"><span class="lv__verdict-k">Longcon, on day ${final.timeline.at(-1)!.day + 1}</span>
            <b>${esc(v.title)}</b><span>${esc(v.action)}</span></div>
          <button class="btn btn--ghost btn--small lv__replay">↻ Replay</button>
        </div>
        <p class="lv__caption">Margaret, 71, and “Mark”. Real lines from our demo conversation, at the day they were sent.</p>
      </div>
    </section>

    <section class="ld-section reveal">
      <h2 class="ld-h2">A spam filter reads one message.<br><span>Longcon reads the pattern.</span></h2>
      <div class="vs">
        <div class="vs__card">
          <p class="vs__k">What a filter sees</p>
          <div class="vs__bubble">Add me on Telegram, my handle is @Eng_Mark.</div>
          <p class="vs__verdict vs__verdict--ok">✓ Nothing wrong</p>
          <p class="vs__note">Polite. No link. No request. Every message on its own passes.</p>
        </div>
        <div class="vs__card vs__card--lc">
          <p class="vs__k">What Longcon sees</p>
          <div class="vs__arc"></div>
          <p class="vs__verdict level-danger">${esc(v.title)}</p>
          <p class="vs__note">Very loving words on day 1. A move to Telegram on day 5. “Don't tell your children” on day 7.
            A crisis, then a request for crypto. The order is the giveaway.</p>
        </div>
      </div>
    </section>

    <section class="ld-dark reveal">
      <p class="ld-num" data-to="4.885">$0.000 billion</p>
      <p class="ld-dark__lead">lost to fraud by people aged 60 and over in 2024, up 43% in one year, in reports to the FBI alone.</p>
      <p class="ld-dark__src">Source: <a href="https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf">FBI IC3, 2024 Internet Crime Report</a></p>
    </section>

    <section class="ld-section reveal">
      <h2 class="ld-h2">Hybrid AI, with the private part first.</h2>
      <p class="ld-lead">Every message is checked on your device. The cloud only helps when you ask, and only sees the warning signs.</p>
      <div class="hy">
        <div class="hy__device">
          <p class="hy__label">${LOCK} Your device. Messages never leave it.</p>
          <div class="hy__steps">
            <div class="hy__step"><b>Quick check</b><span>every message, instantly</span></div>
            <span class="hy__arrow">→</span>
            <div class="hy__step hy__step--nano"><b>Gemini Nano</b><span>12 warning signs, via Firebase AI Logic</span></div>
            <span class="hy__arrow">→</span>
            <div class="hy__step"><b>The Arc</b><span>scores the pattern over weeks</span></div>
          </div>
        </div>
        <div class="hy__bridge"><span>only if you ask</span><span class="hy__dash"></span><small>warning signs, names and numbers removed</small></div>
        <div class="hy__cloud">
          <p class="hy__label">${CLOUD} Google Cloud</p>
          <div class="hy__step hy__step--cloud"><b>Second opinion</b><span>Gemini checks the claims and suggests questions to ask</span></div>
        </div>
      </div>
      <p class="ld-center"><a class="ld-link" href="#/about">Exactly what leaves the device, the limits, and the evidence →</a></p>
    </section>

    <section class="ld-section reveal">
      <h2 class="ld-h2">Made for the people scammers target.</h2>
      <div class="ld-cards">
        <div class="ld-card"><span class="ld-card__big">Aa</span><b>Big, clear type</b><p>Atkinson Hyperlegible, designed for low-vision readers.</p></div>
        <div class="ld-card"><span class="ld-card__big">“ ”</span><b>Plain words</b><p>“Asked you to keep it secret”, never “isolation tactic”.</p></div>
        <div class="ld-card"><span class="ld-card__big">🔊</span><b>Read aloud</b><p>One tap and Longcon says it out loud.</p></div>
        <div class="ld-card"><span class="ld-card__big">♡</span><b>Never blaming</b><p>“These are signs scammers use”, and one clear thing to do next.</p></div>
      </div>
    </section>

    <section class="ld-final reveal">
      <span class="ld-final__mark" aria-hidden="true"></span>
      <h2 class="ld-h2">See the long view for yourself.</h2>
      <p class="ld-lead">Replay six conversations, three scams and three genuine ones, or check one of your own.</p>
      <div class="ld-ctas">
        <a class="btn btn--primary btn--lg" href="#/demo">Try the demo</a>
        <a class="btn btn--lg" href="#/demo/own">Check your own conversation</a>
      </div>
    </section>

    <footer class="ld-foot">
      <span><span class="brand__mark"></span> Longcon · #BuildHybridAI 2026 · Firebase AI Logic + Gemini Nano</span>
      <span><a href="#/about">How it works &amp; limits</a> · <a href="#/bench">Benchmark</a> · <a href="${REPO}">GitHub</a> · Apache-2.0</span>
    </footer>
  </div>`;

  // Legend = the Arc's four stages; the "vs" card gets the full Arc.
  renderArc(final, root.querySelector<HTMLElement>('.vs__arc')!);
  root.querySelector('.lv__legend')!.innerHTML = ['rapport', 'isolation', 'hook', 'extraction']
    .map((st) => `<span class="stage-${st}"><i></i>${({ rapport: 'Getting close', isolation: 'Cutting you off', hook: 'The story', extraction: 'Asking for money' } as Record<string, string>)[st]}</span>`)
    .join('');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lv = root.querySelector<HTMLElement>('.lv')!;
  const run = () => playTimeline(lv, beats, reduced);
  root.querySelector<HTMLButtonElement>('.lv__replay')!.onclick = run;

  // Track colours: each stretch takes the stage of the sign that opened it.
  const stops = beats.map((b, i) => {
    const from = (b.day / (SPAN - 1)) * 100;
    const to = i + 1 < beats.length ? (beats[i + 1]!.day / (SPAN - 1)) * 100 : 100;
    return `var(--stage-${TACTICS[b.tactic].stage}) ${from}% ${to}%`;
  });
  lv.querySelector<HTMLElement>('.lv__fill')!.style.background = `linear-gradient(90deg, ${stops.join(', ')})`;

  // Reveal on scroll; start the timeline and the counter when they come into view.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        if (e.target.classList.contains('ld-long')) run();
        if (e.target.classList.contains('ld-dark')) countUp(e.target.querySelector('.ld-num')!, reduced);
        io.unobserve(e.target);
      }
    },
    { threshold: 0.25 },
  );
  root.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

let timers: number[] = [];

function playTimeline(lv: HTMLElement, beats: Beat[], reduced: boolean): void {
  timers.forEach(clearTimeout);
  timers = [];
  const total = reduced ? 0 : 7000;
  lv.classList.remove('lv--done');
  lv.querySelectorAll('.lv__beat').forEach((b) => b.classList.remove('on'));
  lv.style.setProperty('--dur', '0ms');
  lv.style.setProperty('--p', '0');
  void lv.offsetWidth; // restart the transition
  lv.style.setProperty('--dur', `${total}ms`);
  lv.style.setProperty('--p', '1');
  beats.forEach((b, i) => {
    timers.push(window.setTimeout(() => lv.querySelector(`.lv__beat[data-i="${i}"]`)!.classList.add('on'), (b.day / (SPAN - 1)) * total + 150));
  });
  timers.push(window.setTimeout(() => lv.classList.add('lv--done'), total + 300));
}

function countUp(el: HTMLElement, reduced: boolean): void {
  const to = Number(el.dataset.to);
  const t0 = performance.now();
  const dur = reduced ? 0 : 1600;
  const tick = (now: number) => {
    const p = dur ? Math.min(1, (now - t0) / dur) : 1;
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = `$${(to * eased).toFixed(3)} billion`;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
