import { STAGES, TACTICS, type Stage, type TacticId } from './tactics';
import type { ContactRisk, RiskLevel, TaggedMessage, TimelineEvent } from './types';

/**
 * The risk engine is deliberately plain, deterministic TypeScript, not a model.
 * The models only label individual messages; the scoring is auditable, testable
 * and tunable (thresholds and weights come from Remote Config).
 */
export interface RiskConfig {
  /** Score (0–100) at or above which the conversation is escalated to the cloud judge. */
  escalateAt: number;
  levels: { watch: number; warning: number; danger: number };
  /** Bonus multiplier per additional stage of the scam arc reached, in order. */
  progressionBonus: number;
  /** Repeat sightings of the same tactic add this fraction of its weight each time. */
  repeatFactor: number;
  weights?: Partial<Record<TacticId, number>>;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  escalateAt: 60,
  levels: { watch: 20, warning: 45, danger: 70 },
  progressionBonus: 0.35,
  repeatFactor: 0.25,
};

const DAY_MS = 86_400_000;

export function emptyRisk(contactId: string, at: number): ContactRisk {
  return {
    contactId,
    firstSeenAt: at,
    lastSeenAt: at,
    messagesScanned: 0,
    score: 0,
    level: 'clear',
    stageReached: null,
    timeline: [],
    shouldEscalate: false,
  };
}

/** Fold one tagged message into a contact's risk state. Pure: returns a new object. */
export function applyTagged(
  prev: ContactRisk,
  tagged: TaggedMessage,
  cfg: RiskConfig = DEFAULT_RISK_CONFIG,
): ContactRisk {
  const firstSeenAt = Math.min(prev.firstSeenAt, tagged.sentAt);
  const newEvents: TimelineEvent[] = tagged.hits.map((h) => ({
    day: 0,
    sentAt: tagged.sentAt,
    tactic: h.tactic,
    stage: TACTICS[h.tactic].stage,
    evidence: h.evidence.slice(0, 120),
  }));
  const timeline = [...prev.timeline, ...newEvents]
    .sort((a, b) => a.sentAt - b.sentAt)
    .map((e) => ({ ...e, day: Math.floor((e.sentAt - firstSeenAt) / DAY_MS) }));

  const next: ContactRisk = {
    ...prev,
    firstSeenAt,
    lastSeenAt: Math.max(prev.lastSeenAt, tagged.sentAt),
    messagesScanned: prev.messagesScanned + 1,
    timeline,
  };
  return rescore(next, cfg);
}

export function rescore(risk: ContactRisk, cfg: RiskConfig = DEFAULT_RISK_CONFIG): ContactRisk {
  const counts = new Map<TacticId, number>();
  for (const e of risk.timeline) counts.set(e.tactic, (counts.get(e.tactic) ?? 0) + 1);

  // Base: each distinct tactic counts fully once; repeats add a diminishing amount.
  let raw = 0;
  for (const [tactic, n] of counts) {
    const w = cfg.weights?.[tactic] ?? TACTICS[tactic].weight;
    raw += w * (1 + cfg.repeatFactor * Math.log2(n));
  }

  // Progression: reaching later stages of the arc is what makes a long con.
  const stagesSeen = new Set<Stage>(risk.timeline.map((e) => e.stage));
  const stageIdx = STAGES.reduce((max, s, i) => (stagesSeen.has(s) ? i : max), -1);
  const ordered = isOrderedArc(risk.timeline);
  const progression = 1 + cfg.progressionBonus * Math.max(0, stagesSeen.size - 1) * (ordered ? 1 : 0.5);

  // Squash into 0–100. 1.6 "weight units" ≈ 80.
  const score = Math.round(100 * (1 - Math.exp(-(raw * progression) / 1.0)));
  const level = levelFor(score, cfg);
  return {
    ...risk,
    score,
    level,
    stageReached: stageIdx >= 0 ? STAGES[stageIdx]! : null,
    shouldEscalate: risk.shouldEscalate || score >= cfg.escalateAt,
  };
}

/** True if stages first appear in arc order (rapport → isolation → hook → extraction). */
export function isOrderedArc(timeline: TimelineEvent[]): boolean {
  const firstSeen: number[] = [];
  for (const e of timeline) {
    const i = STAGES.indexOf(e.stage);
    if (!firstSeen.includes(i)) firstSeen.push(i);
  }
  return firstSeen.every((v, i) => i === 0 || v >= firstSeen[i - 1]!);
}

export function levelFor(score: number, cfg: RiskConfig = DEFAULT_RISK_CONFIG): RiskLevel {
  if (score >= cfg.levels.danger) return 'danger';
  if (score >= cfg.levels.warning) return 'warning';
  if (score >= cfg.levels.watch) return 'watch';
  return 'clear';
}
