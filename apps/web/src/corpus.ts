import type { ChatMessage, Channel, TacticId } from '@longcon/core';

/** Stephen's labelled corpus (contracts/corpus), shaped for the demo inbox and the benchmark. */
interface RawMessage {
  id: string;
  timestamp: string;
  channel: Channel;
  senderHandle: string;
  direction: 'in' | 'out';
  text: string;
  expectedTactics: TacticId[];
}
interface RawArc {
  arc: { id: string; label: 'scam' | 'benign'; description: string };
  messages: RawMessage[];
}

export interface DemoConversation {
  id: string;
  label: 'scam' | 'benign';
  /** The person Longcon protects in this conversation. */
  userName: string;
  /** The other party, as the user knows them. */
  contactName: string;
  initial: string;
  channels: Channel[];
  spanDays: number;
  description: string;
  messages: ChatMessage[];
  expected: Map<string, TacticId[]>;
}

const files = import.meta.glob<RawArc>('../../../contracts/corpus/*.json', { eager: true, import: 'default' });
const index = import.meta.glob<{ arcs: { id: string; file: string; spanDays: number }[] }>(
  '../../../contracts/corpus/index.json',
  { eager: true, import: 'default' },
);

const PEOPLE: Record<string, [user: string, contact: string]> = {
  romance_oil_rig: ['Margaret', 'Mark'],
  crypto_investment: ['Tunde', 'Alex, Crypto Prime Markets'],
  fake_job: ['Grace', 'Olivia, Amazon Careers'],
  benign_long_distance: ['Margaret', 'James'],
  benign_recruiter: ['Daniel', 'Northwind Systems'],
  benign_family_money: ['Daniel', 'Amaka'],
};

export const CONVERSATIONS: DemoConversation[] = Object.values(index)[0]!.arcs.map((a) => {
  const raw = Object.entries(files).find(([path]) => path.endsWith(`/${a.file}`))![1];
  const [userName, contactName] = PEOPLE[a.id] ?? ['You', a.id];
  const messages: ChatMessage[] = raw.messages.map((m) => ({
    id: m.id,
    contactId: a.id,
    fromUser: m.direction === 'out',
    text: m.text,
    sentAt: Date.parse(m.timestamp),
    source: m.channel,
  }));
  return {
    id: a.id,
    label: raw.arc.label,
    userName,
    contactName,
    initial: contactName[0]!.toUpperCase(),
    channels: [...new Set(raw.messages.map((m) => m.channel))],
    spanDays: a.spanDays,
    description: raw.arc.description,
    messages,
    expected: new Map(raw.messages.map((m) => [m.id, m.expectedTactics])),
  };
});

export const CHANNEL_NAMES: Record<Channel, string> = {
  gmail: 'Email',
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  sms: 'SMS',
  telegram: 'Telegram',
  demo: 'Demo',
};
