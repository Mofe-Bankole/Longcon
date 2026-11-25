/**
 * Corpus evaluation: how the engine behaves on Stephen's labelled conversations.
 *  - "truth": ground-truth labels fed as on_device tags (upper bound for a perfect model)
 *  - "rules": rung-1 prefilter only (what Android sees in the background)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scoreContact } from './risk';
import { rulesTag } from './rules';
import type { TacticId } from './tactics';
import type { RiskLevel, TaggedMessage } from './types';

const DIR = fileURLToPath(new URL('../../../contracts/corpus/', import.meta.url));
interface Msg { id: string; timestamp: string; direction: 'in' | 'out'; text: string; expectedTactics: TacticId[] }
interface Arc { arc: { id: string; label: 'scam' | 'benign' }; messages: Msg[] }
const index = JSON.parse(readFileSync(DIR + 'index.json', 'utf8')) as { arcs: { file: string }[] };
const arcs: Arc[] = index.arcs.map((a) => JSON.parse(readFileSync(DIR + a.file, 'utf8')));

const ORDER: RiskLevel[] = ['clear', 'watch', 'warning', 'danger'];
const DAY = 86_400_000;

function run(arc: Arc, mode: 'truth' | 'rules') {
  const inbound = arc.messages.filter((m) => m.direction === 'in');
  const t0 = Date.parse(arc.messages[0]!.timestamp);
  const tagged: TaggedMessage[] = [];
  let firstWarning: number | null = null;
  let firstDanger: number | null = null;
  for (const m of inbound) {
    const sentAt = Date.parse(m.timestamp);
    const hits = mode === 'truth' ? m.expectedTactics.map((tactic) => ({ tactic, evidence: '' })) : rulesTag(m.text);
    tagged.push({ messageId: m.id, contactId: arc.arc.id, sentAt, hits, route: mode === 'truth' ? 'on_device' : 'rules', latencyMs: 0 });
    const r = scoreContact(arc.arc.id, tagged);
    const day = Math.floor((sentAt - t0) / DAY);
    if (firstWarning === null && ORDER.indexOf(r.level) >= 2) firstWarning = day;
    if (firstDanger === null && r.level === 'danger') firstDanger = day;
  }
  const firstMoneyAsk = inbound.find((m) => m.expectedTactics.some((t) => ['payment_request', 'risky_payment_method', 'credential_request'].includes(t)));
  const r = scoreContact(arc.arc.id, tagged);
  return { r, firstWarning, firstDanger, moneyDay: firstMoneyAsk ? Math.floor((Date.parse(firstMoneyAsk.timestamp) - t0) / DAY) : null };
}

describe('corpus evaluation', () => {
  const rows: string[] = [];
  for (const arc of arcs) {
    it(`${arc.arc.id} (${arc.arc.label})`, () => {
      for (const mode of ['truth', 'rules'] as const) {
        const { r, firstWarning, firstDanger, moneyDay } = run(arc, mode);
        rows.push(`${arc.arc.id.padEnd(22)} ${mode.padEnd(5)} score=${String(r.score).padStart(3)} ${r.level.padEnd(7)} warnDay=${firstWarning} dangerDay=${firstDanger} firstMoneyAskDay=${moneyDay}`);
        if (mode === 'truth') {
          if (arc.arc.label === 'scam') expect(r.level).toBe('danger');
          else expect(ORDER.indexOf(r.level)).toBeLessThanOrEqual(ORDER.indexOf('watch'));
        }
      }
    });
  }

  it('rules prefilter: per-message precision / recall vs labels', () => {
    let tp = 0, fp = 0, fn = 0;
    const misses = new Map<string, number>();
    for (const arc of arcs)
      for (const m of arc.messages.filter((x) => x.direction === 'in')) {
        const got = new Set(rulesTag(m.text).map((h) => h.tactic));
        const want = new Set(m.expectedTactics);
        for (const t of got) want.has(t) ? tp++ : fp++;
        for (const t of want) if (!got.has(t)) { fn++; misses.set(t, (misses.get(t) ?? 0) + 1); }
      }
    rows.push(`rules: precision=${(tp / (tp + fp)).toFixed(2)} recall=${(tp / (tp + fn)).toFixed(2)} tp=${tp} fp=${fp} fn=${fn} misses=${JSON.stringify(Object.fromEntries(misses))}`);
    console.log('\n' + rows.join('\n'));
  });
});
