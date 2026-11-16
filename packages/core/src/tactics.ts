/**
 * Scam tactics Longcon tracks across a conversation.
 *
 * Long cons follow a recognisable arc. A single message rarely looks dangerous;
 * the progression across stages does. Each tactic belongs to one stage, and the
 * risk engine rewards a conversation for moving forward through the arc.
 */
export type Stage = 'rapport' | 'isolation' | 'hook' | 'extraction';

export const STAGES: readonly Stage[] = ['rapport', 'isolation', 'hook', 'extraction'];

export interface TacticDef {
  id: TacticId;
  stage: Stage;
  /** Base weight (0–1) of seeing this tactic once. Tunable via Remote Config. */
  weight: number;
  label: string;
  /** Short definition given to the model. Keep it tight: Nano has a small context. */
  definition: string;
}

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

export const TACTICS: Record<TacticId, TacticDef> = {
  love_bombing: {
    id: 'love_bombing',
    stage: 'rapport',
    weight: 0.15,
    label: 'Fast intimacy',
    definition: 'Unusually fast affection, flattery or talk of destiny/soulmates with someone they barely know.',
  },
  unverifiable_persona: {
    id: 'unverifiable_persona',
    stage: 'rapport',
    weight: 0.2,
    label: 'Unverifiable persona',
    definition: 'Claims a hard-to-verify life far away: oil rig, military deployment, doctor abroad, ship engineer, widowed expat.',
  },
  move_off_platform: {
    id: 'move_off_platform',
    stage: 'isolation',
    weight: 0.3,
    label: 'Moved to another app',
    definition: 'Asks to continue on another app or channel (Telegram, WhatsApp, Signal, private email, a trading app chat).',
  },
  secrecy_request: {
    id: 'secrecy_request',
    stage: 'isolation',
    weight: 0.45,
    label: 'Asked for secrecy',
    definition: 'Asks them not to tell family, friends or the bank, or to keep the relationship/opportunity private.',
  },
  urgency_pressure: {
    id: 'urgency_pressure',
    stage: 'hook',
    weight: 0.3,
    label: 'Pressure / urgency',
    definition: 'Artificial deadlines, threats, guilt, or "act now or lose out".',
  },
  investment_pitch: {
    id: 'investment_pitch',
    stage: 'hook',
    weight: 0.45,
    label: 'Investment pitch',
    definition: 'Promotes crypto, forex or a trading platform with guaranteed, insider or unusually high returns.',
  },
  crisis_story: {
    id: 'crisis_story',
    stage: 'hook',
    weight: 0.4,
    label: 'Crisis story',
    definition: 'A sudden emergency needing money: medical bill, customs fee, frozen account, stuck abroad, legal trouble.',
  },
  job_offer_bait: {
    id: 'job_offer_bait',
    stage: 'hook',
    weight: 0.35,
    label: 'Too-good job offer',
    definition: 'Easy high-paying job, task-based pay, or a role that needs an upfront fee, equipment purchase or deposit.',
  },
  impersonation: {
    id: 'impersonation',
    stage: 'hook',
    weight: 0.5,
    label: 'Impersonation',
    definition: 'Claims to be a relative on a new number, a bank, a government agency, or a well-known company or person.',
  },
  payment_request: {
    id: 'payment_request',
    stage: 'extraction',
    weight: 0.6,
    label: 'Asked for money',
    definition: 'Directly asks them to send, deposit, lend or "invest" money.',
  },
  risky_payment_method: {
    id: 'risky_payment_method',
    stage: 'extraction',
    weight: 0.7,
    label: 'Untraceable payment',
    definition: 'Asks for crypto (USDT, BTC), gift cards, wire transfer, P2P to a stranger, or cash courier.',
  },
  credential_request: {
    id: 'credential_request',
    stage: 'extraction',
    weight: 0.7,
    label: 'Asked for codes',
    definition: 'Asks for an OTP, verification code, password, PIN, seed phrase or remote access to a device.',
  },
};

export function isTacticId(x: unknown): x is TacticId {
  return typeof x === 'string' && (TACTIC_IDS as readonly string[]).includes(x);
}
