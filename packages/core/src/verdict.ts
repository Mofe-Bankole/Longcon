import { TACTICS, type TacticId } from './tactics';
import type { ContactRisk, RiskLevel } from './types';

/**
 * Plain-words verdicts for the protected person (docs/design.md). Deterministic, no model:
 * calm until it matters, never blames, one sentence plus one action.
 */
export interface Verdict {
  level: RiskLevel;
  /** Short level name: "Nothing worrying" … "This looks like a scam". */
  title: string;
  /** One sentence about this contact. */
  sentence: string;
  /** The one thing to do now. */
  action: string;
}

export const LEVEL_TITLES: Record<RiskLevel, string> = {
  clear: 'Nothing worrying',
  watch: 'Keep an eye on this',
  warning: 'Some warning signs',
  danger: 'This looks like a scam',
};

export function verdictFor(risk: ContactRisk, name: string): Verdict {
  const signs = topSigns(risk, 2).map((t) => TACTICS[t].plain.toLowerCase());
  const list = signs.length === 2 ? `${signs[0]}, and ${signs[1]}` : (signs[0] ?? '');
  const sentence: Record<RiskLevel, string> = {
    clear: `Your conversation with ${name} looks normal.`,
    watch: `${name}'s messages show one sign scammers sometimes use: ${list}. It may be nothing.`,
    warning: `${name}'s messages follow a pattern scammers use: ${list}.`,
    danger: `${name}'s messages match a scam pattern: ${list}.`,
  };
  const action: Record<RiskLevel, string> = {
    clear: 'No action needed.',
    watch: 'Carry on, and Longcon will keep watching.',
    warning: 'Before you send money or codes, ask someone you trust.',
    danger: "Please don't send money, gift cards or codes. Talk to someone you trust first.",
  };
  return { level: risk.level, title: LEVEL_TITLES[risk.level], sentence: sentence[risk.level], action: action[risk.level] };
}

/** Most serious distinct signs first: later stage, then higher weight, then most recent. */
export function topSigns(risk: ContactRisk, n = 3): TacticId[] {
  const latest = new Map<TacticId, number>();
  for (const e of risk.timeline) latest.set(e.tactic, Math.max(latest.get(e.tactic) ?? 0, e.sentAt));
  const stageRank = { rapport: 0, isolation: 1, hook: 2, extraction: 3 };
  return [...latest.keys()]
    .sort(
      (a, b) =>
        stageRank[TACTICS[b].stage] - stageRank[TACTICS[a].stage] ||
        TACTICS[b].weight - TACTICS[a].weight ||
        latest.get(b)! - latest.get(a)!,
    )
    .slice(0, n);
}
