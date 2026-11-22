import contract from '../../../contracts/tactics.json';
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
  /** Score at or above which we ask the person to run a private check (Android tap-to-check). */
  checkAt: number;
  levels: { watch: number; warning: number; danger: number };
  /** Bonus multiplier per additional stage of the scam arc reached, in order. */
  progressionBonus: number;
  /** Repeat sightings of the same tactic add this fraction of its weight each time. */
  repeatFactor: number;
  /** Weight multiplier for tactics seen ONLY by the rules prefilter (unconfirmed by a model). */
  rulesDiscount: number;
  /** Weight units that map to ~63/100. Higher = the score climbs more slowly. */
  saturation: number;
  weights?: Partial<Record<TacticId, number>>;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = contract.riskConfig;

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
    shouldCheck: false,
    routes: { rules: 0, on_device: 0, in_cloud: 0 },
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
    messageId: tagged.messageId,
    route: tagged.route,
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
  const confirmed = new Set<TacticId>();
  const routes = { rules: 0, on_device: 0, in_cloud: 0 };
  for (const e of risk.timeline) {
    counts.set(e.tactic, (counts.get(e.tactic) ?? 0) + 1);
    if (e.route !== 'rules') confirmed.add(e.tactic);
    routes[e.route]++;
  }

  // Base: each distinct tactic counts fully once; repeats add a diminishing amount.
  // Tactics only the keyword prefilter saw count for less until a model confirms them.
  let raw = 0;
  for (const [tactic, n] of counts) {
    const w = (cfg.weights?.[tactic] ?? TACTICS[tactic].weight) * (confirmed.has(tactic) ? 1 : cfg.rulesDiscount);
    raw += w * (1 + cfg.repeatFactor * Math.log2(n));
  }

  // Progression: reaching later stages of the arc is what makes a long con.
  const stagesSeen = new Set<Stage>(risk.timeline.map((e) => e.stage));
  const stageIdx = STAGES.reduce((max, s, i) => (stagesSeen.has(s) ? i : max), -1);
  const ordered = isOrderedArc(risk.timeline);
  const progression = 1 + cfg.progressionBonus * Math.max(0, stagesSeen.size - 1) * (ordered ? 1 : 0.5);

  // Squash into 0–100.
  const score = Math.round(100 * (1 - Math.exp(-(raw * progression) / cfg.saturation)));
  // "Danger" means money or codes were asked for. Before that, the worst is a warning:
  // real partners and families also say loving things, mention emergencies, or ask for privacy.
  const level = capLevel(levelFor(score, cfg), stagesSeen.has('extraction'));
  return {
    ...risk,
    score,
    level,
    stageReached: stageIdx >= 0 ? STAGES[stageIdx]! : null,
    shouldEscalate: risk.shouldEscalate || score >= cfg.escalateAt,
    shouldCheck: risk.shouldCheck || score >= cfg.checkAt,
    routes,
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

/**
 * Score a contact from scratch from its tagged messages (any order).
 * The router uses this when a model result replaces a provisional rules result.
 */
export function scoreContact(
  contactId: string,
  tagged: TaggedMessage[],
  cfg: RiskConfig = DEFAULT_RISK_CONFIG,
): ContactRisk {
  const sorted = [...tagged].sort((a, b) => a.sentAt - b.sentAt || a.messageId.localeCompare(b.messageId));
  const start = sorted[0]?.sentAt ?? 0;
  return sorted.reduce((r, t) => applyTagged(r, t, cfg), emptyRisk(contactId, start));
}

function capLevel(level: RiskLevel, extractionSeen: boolean): RiskLevel {
  return level === 'danger' && !extractionSeen ? 'warning' : level;
}
