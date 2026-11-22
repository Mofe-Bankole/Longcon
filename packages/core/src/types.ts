import type { Stage, TacticId } from './tactics';

/** Where a model call actually ran. Mirrors firebase/ai InferenceSource. */
export type Route = 'on_device' | 'in_cloud' | 'rules';

export type Channel = 'gmail' | 'whatsapp' | 'messenger' | 'sms' | 'telegram' | 'demo';

/** A chat message as read from WhatsApp Web, Gmail, the demo inbox, etc. */
export interface ChatMessage {
  id: string;
  /** Stable id for the other party (phone, email, handle). Never leaves the device. */
  contactId: string;
  /** true if the user sent it, false if the contact did. */
  fromUser: boolean;
  text: string;
  /** Epoch millis. */
  sentAt: number;
  source: Channel;
}

export interface TacticHit {
  tactic: TacticId;
  /** Short quote from the message that shows the tactic (≤ 120 chars). Stays on device. */
  evidence: string;
}

export interface TaggedMessage {
  messageId: string;
  contactId: string;
  sentAt: number;
  hits: TacticHit[];
  route: Route;
  latencyMs: number;
}

export interface TimelineEvent {
  messageId: string;
  /** How this event was produced. `rules` events are provisional. */
  route: Route;
  /** Days since the first message with this contact. */
  day: number;
  sentAt: number;
  tactic: TacticId;
  stage: Stage;
  evidence: string;
}

export type RiskLevel = 'clear' | 'watch' | 'warning' | 'danger';

export interface ContactRisk {
  contactId: string;
  firstSeenAt: number;
  lastSeenAt: number;
  messagesScanned: number;
  /** 0–100. */
  score: number;
  level: RiskLevel;
  /** Furthest stage of the scam arc reached so far. */
  stageReached: Stage | null;
  timeline: TimelineEvent[];
  /** True once the score crossed the escalation threshold. */
  shouldEscalate: boolean;
  /** True once the score crossed the "tap to check" threshold (Android) / "check now" prompt (web). */
  shouldCheck: boolean;
  /** How many timeline events each route produced. */
  routes: Record<Route, number>;
}
