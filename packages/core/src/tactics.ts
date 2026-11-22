/**
 * Scam tactics Longcon tracks across a conversation.
 *
 * Long cons follow a recognisable arc. A single message rarely looks dangerous;
 * the progression across stages does. Each tactic belongs to one stage, and the
 * risk engine rewards a conversation for moving forward through the arc.
 *
 * The data lives in /contracts/tactics.json, shared with the Kotlin app.
 * This file only adds types and checks that the JSON matches them.
 */
import contract from '../../../contracts/tactics.json';

export type Stage = 'rapport' | 'isolation' | 'hook' | 'extraction';

export const STAGES: readonly Stage[] = ['rapport', 'isolation', 'hook', 'extraction'];

export const TACTIC_IDS = [
  'love_bombing',
  'unverifiable_persona',
  'move_off_platform',
  'secrecy_request',
  'urgency_pressure',
  'investment_pitch',
  'crisis_story',
  'job_offer_bait',
  'impersonation',
  'payment_request',
  'risky_payment_method',
  'credential_request',
] as const;

export type TacticId = (typeof TACTIC_IDS)[number];

export interface TacticDef {
  id: TacticId;
  stage: Stage;
  /** Base weight (0–1) of seeing this tactic once. Tunable via Remote Config. */
  weight: number;
  /** Short label for the guardian dashboard. */
  label: string;
  /** Plain words for the protected person (65+, any literacy). */
  plain: string;
  /** Definition given to the model. Keep it tight: Nano has a small context. */
  definition: string;
  /** Rung-1 prefilter patterns (case-insensitive, portable JS/Java regex). */
  rules: string[];
}

export const CONTRACT_VERSION: number = contract.version;
export const STAGE_LABELS = contract.stageLabels as Record<Stage, string>;

export const TACTICS = Object.fromEntries(
  contract.tactics.map((t) => [t.id, t as TacticDef]),
) as Record<TacticId, TacticDef>;

// Fail fast if the JSON and the type drift apart.
for (const id of TACTIC_IDS) {
  const t = TACTICS[id];
  if (!t || !STAGES.includes(t.stage)) throw new Error(`contracts/tactics.json: bad or missing tactic "${id}"`);
}
if (contract.tactics.length !== TACTIC_IDS.length) throw new Error('contracts/tactics.json: unknown tactic id');

export function isTacticId(x: unknown): x is TacticId {
  return typeof x === 'string' && (TACTIC_IDS as readonly string[]).includes(x);
}
