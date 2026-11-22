import { TACTIC_IDS, TACTICS, type TacticId } from './tactics';
import type { TacticHit } from './types';

/**
 * Rung 1 of the privacy ladder: an instant keyword/regex prefilter.
 * Runs on every message, everywhere (including Android background), with no model and no network.
 * Its hits are provisional: an on-device model result for the same message replaces them.
 */
const COMPILED: [TacticId, RegExp[]][] = TACTIC_IDS.map((id) => [
  id,
  TACTICS[id].rules.map((p) => new RegExp(p, 'i')),
]);

export function rulesTag(text: string): TacticHit[] {
  const hits: TacticHit[] = [];
  for (const [tactic, res] of COMPILED) {
    for (const re of res) {
      const m = re.exec(text);
      if (m) {
        hits.push({ tactic, evidence: around(text, m.index, m[0].length) });
        break;
      }
    }
  }
  return hits;
}

/** The match plus a little context, trimmed to word boundaries, ≤ 120 chars. */
function around(text: string, start: number, len: number): string {
  const pad = Math.max(0, Math.floor((120 - len) / 2));
  let a = Math.max(0, start - pad);
  let b = Math.min(text.length, start + len + pad);
  if (a > 0) a = text.indexOf(' ', a) + 1 || a;
  if (b < text.length) b = text.lastIndexOf(' ', b) > start + len ? text.lastIndexOf(' ', b) : b;
  return text.slice(a, b).trim().slice(0, 120);
}
