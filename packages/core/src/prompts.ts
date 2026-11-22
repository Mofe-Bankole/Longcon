import { TACTIC_IDS, TACTICS } from './tactics';

const HIT = {
  type: 'object',
  properties: {
    tactic: { type: 'string', enum: [...TACTIC_IDS] },
    evidence: { type: 'string', maxLength: 100 },
  },
  required: ['tactic', 'evidence'],
} as const;

/** JSON Schema for tagging ONE message. Shared by Nano (responseConstraint) and cloud (responseJsonSchema). */
export const TAG_SCHEMA = {
  type: 'object',
  properties: { hits: { type: 'array', maxItems: 4, items: HIT } },
  required: ['hits'],
} as const;

/**
 * JSON Schema for tagging a BATCH of messages in one call.
 * Latency: the Firebase SDK opens a fresh Nano session (and re-reads the system prompt) on every
 * call, so tagging 6 messages in one call costs far less than 6 calls.
 */
export const BATCH_TAG_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: { n: { type: 'integer' }, hits: { type: 'array', maxItems: 4, items: HIT } },
        required: ['n', 'hits'],
      },
    },
  },
  required: ['results'],
} as const;

const TACTIC_LINES = TACTIC_IDS.map((id) => `- ${id}: ${TACTICS[id].definition}`);

export const TAGGER_SYSTEM = [
  'You label ONE chat message for scam tactics. You see the message and, for context, a few earlier messages.',
  'Only label tactics clearly present in the CURRENT message. Most messages are normal: return {"hits": []}.',
  'Evidence must be a short exact quote from the current message.',
  'Tactics:',
  ...TACTIC_LINES,
].join('\n');

export const BATCH_TAGGER_SYSTEM = [
  'You label numbered chat messages from ONE contact for scam tactics.',
  'Label each message on its own. Only label tactics clearly present in that message. Most messages are normal: give them "hits": [].',
  'Return one result per message, with its number n. Evidence must be a short exact quote from that message.',
  'Tactics:',
  ...TACTIC_LINES,
].join('\n');

export function taggerPrompt(current: string, context: string[]): string {
  const ctx = context.length ? context.map((c) => `> ${c}`).join('\n') : '(none)';
  return `Earlier messages:\n${ctx}\n\nCURRENT message from the contact:\n"""${current}"""\n\nReturn JSON.`;
}

/** Messages are numbered from 1. Long messages are clipped so a batch stays well inside Nano's window. */
export function batchTaggerPrompt(messages: string[], context: string[]): string {
  const ctx = context.length ? context.map((c) => `> ${clip(c, 200)}`).join('\n') : '(none)';
  const body = messages.map((m, i) => `[${i + 1}] ${clip(m, 600)}`).join('\n');
  return `Earlier messages (context only, do not label):\n${ctx}\n\nMessages to label:\n${body}\n\nReturn JSON.`;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s).replace(/\s+/g, ' ');
