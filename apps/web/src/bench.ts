import {
  createTaggerModel,
  envFromVite,
  initLongcon,
  rulesTag,
  scoreContact,
  tagBatch,
  tagMessage,
  TACTIC_IDS,
  type RiskLevel,
  type Route,
  type TacticId,
  type TaggedMessage,
} from '@longcon/core';
import { CONVERSATIONS as ALL, type DemoConversation } from './corpus';

// Only the labelled corpus is benchmarked, never a person's own imported chat.
const CONVERSATIONS = ALL.filter((c) => c.label !== 'own');
import { state } from './engine';
import { esc, fmtMs } from './panel';

/**
 * Benchmark: runs Stephen's labelled corpus through each route and measures accuracy and latency.
 * Results download as JSON (bench/results-*.json in the repo) and feed the write-up.
 */
type Mode = 'rules' | 'on_device_batch' | 'on_device_single' | 'in_cloud_batch';

interface ArcResult {
  id: string;
  label: 'scam' | 'benign';
  finalLevel: RiskLevel;
  score: number;
  firstWarningDay: number | null;
  firstDangerDay: number | null;
  firstMoneyAskDay: number | null;
}
interface ModeResult {
  mode: Mode;
  routes: Partial<Record<Route, number>>;
  messages: number;
  calls: number;
  latency: { perMessageP50: number; perMessageP95: number; perCallP50: number; totalMs: number };
  tactics: { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number };
  perTactic: Record<string, { tp: number; fp: number; fn: number }>;
  arcs: ArcResult[];
  errors: number;
}

const MONEY: TacticId[] = ['payment_request', 'risky_payment_method', 'credential_request'];
const ORDER: RiskLevel[] = ['clear', 'watch', 'warning', 'danger'];
const DAY = 86_400_000;

export function mountBench(root: HTMLElement): void {
  root.innerHTML = `
    <div class="bench">
      <a class="brand" href="#/"><span class="brand__mark"></span>Longcon</a>
      <h1>Benchmark</h1>
      <p class="lead">Runs ${CONVERSATIONS.length} labelled conversations
        (${CONVERSATIONS.reduce((n, c) => n + c.messages.filter((m) => !m.fromUser).length, 0)} incoming messages)
        through each route. Keep the computer plugged in and don't use the browser while it runs.</p>
      <fieldset class="bench__modes">
        <label><input type="checkbox" value="rules" checked disabled> Quick check (rules)</label>
        <label><input type="checkbox" value="on_device_batch" checked> On-device, 6 messages per call</label>
        <label><input type="checkbox" value="on_device_single" checked> On-device, 1 message per call</label>
        <label><input type="checkbox" value="in_cloud_batch"> Cloud, 6 per call <span class="muted">(sends these made-up messages to Google)</span></label>
      </fieldset>
      <button class="btn btn--primary" id="run">Run benchmark</button>
      <p id="status" class="muted"></p>
      <div id="out"></div>
    </div>`;
  root.querySelector<HTMLButtonElement>('#run')!.onclick = async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    const modes = [...root.querySelectorAll<HTMLInputElement>('.bench__modes input:checked')].map((i) => i.value as Mode);
    const results: ModeResult[] = [];
    for (const mode of modes) {
      if (mode.startsWith('on_device') && state.status !== 'ready') {
        status(`Skipping ${mode}: the private model isn't ready on this computer.`);
        continue;
      }
      results.push(await runMode(mode));
      render(root.querySelector('#out')!, results);
    }
    const payload = {
      at: new Date().toISOString(),
      device: {
        userAgent: navigator.userAgent,
        cores: navigator.hardwareConcurrency,
        memoryGB: (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null,
      },
      results,
    };
    download(`longcon-bench-${Date.now()}.json`, JSON.stringify(payload, null, 2));
    status('Done. The results file has downloaded. Send it to Mofe.');
    btn.disabled = false;
  };
}

async function runMode(mode: Mode): Promise<ModeResult> {
  const env = envFromVite(import.meta.env);
  const ai = initLongcon(env);
  const batch = mode !== 'on_device_single';
  const model =
    mode === 'rules'
      ? undefined
      : createTaggerModel(ai, { allowCloudFallback: false, forceCloud: mode === 'in_cloud_batch', batch, cloudModel: env.cloudModel });

  const perMsg: number[] = [];
  const perCall: number[] = [];
  const routes: Partial<Record<Route, number>> = {};
  const perTactic: ModeResult['perTactic'] = Object.fromEntries(TACTIC_IDS.map((t) => [t, { tp: 0, fp: 0, fn: 0 }]));
  const arcs: ArcResult[] = [];
  let errors = 0;
  let messages = 0;
  const t0 = performance.now();

  for (const conv of CONVERSATIONS) {
    const inbound = conv.messages.filter((m) => !m.fromUser);
    const tagged: TaggedMessage[] = [];
    for (let i = 0; i < inbound.length; i += batch ? 6 : 1) {
      const chunk = inbound.slice(i, i + (batch ? 6 : 1));
      status(`${label(mode)} · ${conv.userName} & ${conv.contactName} · ${i + chunk.length}/${inbound.length}`);
      const ctx = conv.messages.filter((m) => m.sentAt < chunk[0]!.sentAt).slice(-3).map((m) => `${m.fromUser ? 'You' : 'Them'}: ${m.text}`);
      const c0 = performance.now();
      let out: TaggedMessage[];
      try {
        if (!model) out = chunk.map((m) => ({ messageId: m.id, contactId: m.contactId, sentAt: m.sentAt, hits: rulesTag(m.text), route: 'rules' as Route, latencyMs: 0 }));
        else if (batch) out = await tagBatch(model, chunk, ctx);
        else out = [await tagMessage(model, chunk[0]!, ctx)];
      } catch (err) {
        console.warn(err);
        errors++;
        out = chunk.map((m) => ({ messageId: m.id, contactId: m.contactId, sentAt: m.sentAt, hits: [], route: 'rules' as Route, latencyMs: 0 }));
      }
      const ms = performance.now() - c0;
      perCall.push(ms);
      for (const t of out) {
        perMsg.push(ms / out.length);
        routes[t.route] = (routes[t.route] ?? 0) + 1;
        messages++;
      }
      tagged.push(...out);
    }
    score(conv, tagged, perTactic);
    arcs.push(arcOutcome(conv, tagged));
  }

  const tp = sum(perTactic, 'tp'), fp = sum(perTactic, 'fp'), fn = sum(perTactic, 'fn');
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    mode,
    routes,
    messages,
    calls: perCall.length,
    latency: { perMessageP50: q(perMsg, 0.5), perMessageP95: q(perMsg, 0.95), perCallP50: q(perCall, 0.5), totalMs: Math.round(performance.now() - t0) },
    tactics: { precision: r2(precision), recall: r2(recall), f1: r2(precision + recall ? (2 * precision * recall) / (precision + recall) : 0), tp, fp, fn },
    perTactic,
    arcs,
    errors,
  };
}

function score(conv: DemoConversation, tagged: TaggedMessage[], acc: ModeResult['perTactic']): void {
  for (const t of tagged) {
    const want = new Set(conv.expected.get(t.messageId) ?? []);
    const got = new Set(t.hits.map((h) => h.tactic));
    for (const x of got) want.has(x) ? acc[x]!.tp++ : acc[x]!.fp++;
    for (const x of want) if (!got.has(x)) acc[x]!.fn++;
  }
}

function arcOutcome(conv: DemoConversation, tagged: TaggedMessage[]): ArcResult {
  const t0 = conv.messages[0]!.sentAt;
  const day = (at: number) => Math.floor((at - t0) / DAY);
  let firstWarningDay: number | null = null;
  let firstDangerDay: number | null = null;
  const sorted = [...tagged].sort((a, b) => a.sentAt - b.sentAt);
  for (let i = 1; i <= sorted.length; i++) {
    const r = scoreContact(conv.id, sorted.slice(0, i));
    const d = day(sorted[i - 1]!.sentAt);
    if (firstWarningDay === null && ORDER.indexOf(r.level) >= 2) firstWarningDay = d;
    if (firstDangerDay === null && r.level === 'danger') firstDangerDay = d;
  }
  const final = scoreContact(conv.id, sorted);
  const money = conv.messages.find((m) => !m.fromUser && (conv.expected.get(m.id) ?? []).some((t) => MONEY.includes(t)));
  return {
    id: conv.id,
    label: conv.label as 'scam' | 'benign',
    finalLevel: final.level,
    score: final.score,
    firstWarningDay,
    firstDangerDay,
    firstMoneyAskDay: money ? day(money.sentAt) : null,
  };
}

function render(el: Element, results: ModeResult[]): void {
  el.innerHTML = `
    <h2>Accuracy and speed</h2>
    <table class="tbl"><thead><tr><th>Route</th><th>Ran on</th><th>Precision</th><th>Recall</th><th>F1</th><th>Per message (typical / slow)</th><th>Calls</th><th>Errors</th></tr></thead><tbody>
    ${results.map((r) => `<tr><td>${label(r.mode)}</td><td>${Object.entries(r.routes).map(([k, v]) => `${k} ${v}`).join(', ')}</td><td>${r.tactics.precision}</td><td>${r.tactics.recall}</td><td><b>${r.tactics.f1}</b></td><td>${fmtMs(r.latency.perMessageP50)} / ${fmtMs(r.latency.perMessageP95)}</td><td>${r.calls}</td><td>${r.errors}</td></tr>`).join('')}
    </tbody></table>
    <h2>When would Longcon have warned?</h2>
    <table class="tbl"><thead><tr><th>Conversation</th>${results.map((r) => `<th>${label(r.mode)}</th>`).join('')}</tr></thead><tbody>
    ${CONVERSATIONS.map((c, i) => `<tr><td>${esc(c.userName)} &amp; ${esc(c.contactName)} <span class="muted">(${c.label}${results[0]?.arcs[i]?.firstMoneyAskDay != null ? `, money asked day ${results[0]!.arcs[i]!.firstMoneyAskDay! + 1}` : ''})</span></td>${results.map((r) => {
      const a = r.arcs[i]!;
      return `<td>${a.label === 'scam' ? (a.firstWarningDay != null ? `warned day ${a.firstWarningDay + 1}` : 'missed') : a.firstWarningDay != null ? `<b>false alarm day ${a.firstWarningDay + 1}</b>` : 'no alarm ✓'} <span class="muted">(${a.finalLevel})</span></td>`;
    }).join('')}</tr>`).join('')}
    </tbody></table>`;
}

const label = (m: Mode) => ({ rules: 'Quick check', on_device_batch: 'On-device ×6', on_device_single: 'On-device ×1', in_cloud_batch: 'Cloud ×6' })[m];
const status = (s: string) => (document.getElementById('status')!.textContent = s);
const q = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]!) : 0;
};
const r2 = (x: number) => Math.round(x * 100) / 100;
const sum = (acc: ModeResult['perTactic'], k: 'tp' | 'fp' | 'fn') => Object.values(acc).reduce((n, v) => n + v[k], 0);

function download(name: string, text: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
