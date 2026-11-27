import { renderArc } from '@longcon/ui';
import { esc } from './panel';

/**
 * "How it works" for judges: the idea, the hybrid ladder, exactly what leaves the device,
 * measured results (from bench/*.json when present), honest limits, and evidence links.
 */
const REPO = 'https://github.com/Mofe-Bankole/Longcon/blob/main/';

interface BenchFile {
  at: string;
  device: { userAgent: string };
  results: {
    mode: string;
    routes: Record<string, number>;
    tactics: { precision: number; recall: number; f1: number };
    latency: { perMessageP50: number; perMessageP95: number };
    arcs: { id: string; label: string; firstWarningDay: number | null; firstMoneyAskDay: number | null; finalLevel: string }[];
  }[];
}
const benches = Object.values(import.meta.glob<BenchFile>('../../../bench/*.json', { eager: true, import: 'default' }));
const bench = benches.sort((a, b) => b.at.localeCompare(a.at))[0];

const EVIDENCE: [claim: string, where: string, path: string][] = [
  ['Every message is labelled by Gemini Nano through Firebase AI Logic hybrid inference', 'createTaggerModel(), tagBatch()', 'packages/core/src/ai.ts'],
  ['No silent cloud fallback: ONLY_ON_DEVICE unless the person consents', 'TaggerOptions.allowCloudFallback, applyTagger()', 'apps/web/src/engine.ts'],
  ['Each result reports where it actually ran (inferenceSource)', 'tagMessage() / tagBatch() → route', 'packages/core/src/ai.ts'],
  ['Instant keyword check, then batched Nano, riskiest contact first, cached', 'Router + tests', 'packages/core/src/router.ts'],
  ['Keywords alone can never say "scam"; a model must confirm', 'capLevel()', 'packages/core/src/risk.ts'],
  ['Web and Android score identically', 'shared golden vectors, run by TS and Kotlin in CI', 'contracts/README.md'],
  ['The cloud sees only redacted warning signs, never the conversation', 'judgeSummary() + tests; the UI shows "What Google saw"', 'packages/core/src/judge.ts'],
  ['App Check protects every AI call', 'initLongcon(): reCAPTCHA Enterprise (web), debug provider (extension/APK)', 'packages/core/src/ai.ts'],
  ['Labelled test conversations, scams and genuine look-alikes', '6 arcs, ~330 messages, validator', 'contracts/corpus/index.json'],
  ['No false alarms on the genuine conversations', 'corpus evaluation test', 'packages/core/src/corpus.eval.test.ts'],
];

export function mountAbout(root: HTMLElement): void {
  root.innerHTML = `
  <div class="about">
    <header class="about__top"><a class="brand" href="#/"><span class="brand__mark"></span>Longcon</a>
      <nav><a href="#/">Try the demo</a><a href="#/bench">Benchmark</a><a href="${REPO.replace('/blob/main/', '')}">GitHub</a></nav></header>

    <section class="hero">
      <h1>Catch the scams that take weeks, without your chats leaving your device.</h1>
      <p class="lead">Romance, crypto and fake-job scams don't look dangerous in any single message. They build up slowly:
        first affection, then secrecy, then a story, then "send USDT". Longcon reads that long game on your own device
        with Gemini Nano, and warns you, in plain words, before the money goes.</p>
      <div class="hero__arc"></div>
      <p><a class="btn btn--primary" href="#/">Watch it read Margaret's 3 weeks →</a></p>
    </section>

    <section>
      <h2>Hybrid by design</h2>
      <ol class="ladder">
        <li><b>Quick check</b> <span>Every message, instantly, on the device. Keyword patterns from a shared contract. Never enough on its own to say "scam".</span></li>
        <li><b>Gemini Nano, on the device</b> <span>Labels every message for 12 warning signs (structured JSON), batched and cached, through Firebase AI Logic with <code>ONLY_ON_DEVICE</code>. Free, fast, private.</span></li>
        <li><b>The Arc</b> <span>A deterministic, tested risk engine scores the progression (getting close → cutting you off → the story → asking for money). The same tests run on web and Android.</span></li>
        <li><b>Second opinion, in the cloud</b> <span>Only for flagged conversations, only on a click. Gemini (with Google Search grounding where available) receives a redacted list of warning signs, never the conversation.</span></li>
      </ol>
      <p class="note">No silent fallback: if a computer can't run Nano, Longcon still does the quick check and <i>asks</i> before anything is sent to Google.</p>
    </section>

    <section>
      <h2>Exactly what leaves the device</h2>
      <table class="tbl"><thead><tr><th>Where it goes</th><th>What is sent</th><th>When</th></tr></thead><tbody>
        <tr><td>Nowhere (Nano on device)</td><td>Nothing</td><td>Every message, by default</td></tr>
        <tr><td>Gemini (cloud labelling)</td><td>The message text</td><td>Only if the person ticks the consent box (e.g. no Nano on this computer)</td></tr>
        <tr><td>Gemini (second opinion)</td><td>Warning-sign names, days, and ≤100-character quotes of the flagged lines, with names, emails, phone and account numbers removed</td><td>Only when the person clicks "Get a second opinion". The panel shows the exact text sent.</td></tr>
      </tbody></table>
    </section>

    <section>
      <h2>Measured, not claimed</h2>
      <div id="bench-summary"></div>
    </section>

    <section>
      <h2>Limits, honestly</h2>
      <ul class="limits">
        <li>On-device Nano needs desktop Chrome with a capable GPU (or 16 GB RAM on CPU). Elsewhere the quick check runs and cloud labelling is opt-in.</li>
        <li>The demo uses six made-up conversations written by our team, not real victims' messages. English only so far.</li>
        <li>Google Search grounding for the second opinion needs Firebase's paid plan; on the free plan Longcon falls back to Gemini alone and says so on the card.</li>
        <li>Android: Nano only runs while Longcon is open (an Android rule), so in the background the phone runs the quick check and asks the person to tap to check privately.</li>
        <li>The guardian dashboard and cross-device household sync are designed (see architecture) but not part of this build.</li>
        <li>iOS is designed, not built.</li>
      </ul>
    </section>

    <section>
      <h2>Evidence for judges</h2>
      <table class="tbl"><thead><tr><th>Claim</th><th>Where to check</th></tr></thead><tbody>
        ${EVIDENCE.map(([c, w, p]) => `<tr><td>${esc(c)}</td><td><a href="${REPO + p}">${esc(p)}</a><br><span class="muted">${esc(w)}</span></td></tr>`).join('')}
      </tbody></table>
    </section>
    <footer class="about__foot">Built for #BuildHybridAI 2026 · Apache-2.0 licensed · Firebase AI Logic · Gemini Nano</footer>
  </div>`;

  renderArc(
    {
      timeline: [
        { messageId: 'a', route: 'on_device', day: 0, sentAt: 0, tactic: 'love_bombing', stage: 'rapport', evidence: '' },
        { messageId: 'b', route: 'on_device', day: 4, sentAt: 1, tactic: 'move_off_platform', stage: 'isolation', evidence: '' },
        { messageId: 'c', route: 'on_device', day: 10, sentAt: 2, tactic: 'investment_pitch', stage: 'hook', evidence: '' },
        { messageId: 'd', route: 'on_device', day: 15, sentAt: 3, tactic: 'payment_request', stage: 'extraction', evidence: '' },
      ],
    },
    root.querySelector<HTMLElement>('.hero__arc')!,
  );
  renderBench(root.querySelector('#bench-summary')!);
}

function renderBench(el: Element): void {
  if (!bench) {
    el.innerHTML = `<p class="note">Benchmark results from our Nano test machine will appear here. Run it yourself on any Nano-capable Chrome at <a href="#/bench">#/bench</a>.</p>`;
    return;
  }
  const label: Record<string, string> = { rules: 'Quick check', on_device_batch: 'Nano on device, 6 per call', on_device_single: 'Nano on device, 1 per call', in_cloud_batch: 'Gemini in the cloud, 6 per call' };
  el.innerHTML = `
    <table class="tbl"><thead><tr><th>Route</th><th>F1</th><th>Precision</th><th>Recall</th><th>Per message (typical / slow)</th></tr></thead><tbody>
    ${bench.results.map((r) => `<tr><td>${label[r.mode] ?? r.mode}</td><td><b>${r.tactics.f1}</b></td><td>${r.tactics.precision}</td><td>${r.tactics.recall}</td><td>${r.latency.perMessageP50} ms / ${r.latency.perMessageP95} ms</td></tr>`).join('')}
    </tbody></table>
    <p class="muted">Run on ${esc(bench.at.slice(0, 10))}. Device: ${esc(bench.device.userAgent.replace(/^.*?\(([^)]*)\).*$/, '$1'))}. Raw results: bench/ in the repo.</p>`;
}
