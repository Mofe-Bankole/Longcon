import { TACTIC_IDS, TACTICS } from './tactics';

/** JSON Schema for the per-message tagger. Shared by Nano (responseConstraint) and cloud (responseJsonSchema). */
export const TAG_SCHEMA = {
  type: 'object',
  properties: {
    hits: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          tactic: { type: 'string', enum: [...TACTIC_IDS] },
          evidence: { type: 'string', maxLength: 120 },
        },
        required: ['tactic', 'evidence'],
      },
    },
  },
  required: ['hits'],
} as const;

export const TAGGER_SYSTEM = [
  'You label ONE chat message for scam tactics. You see the message and, for context, a few earlier messages.',
  'Only label tactics clearly present in the CURRENT message. Most messages are normal: return {"hits": []}.',
  'Evidence must be a short exact quote from the current message.',
  'Tactics:',
  ...TACTIC_IDS.map((id) => `- ${id}: ${TACTICS[id].definition}`),
].join('\n');

export function taggerPrompt(current: string, context: string[]): string {
  const ctx = context.length ? context.map((c) => `> ${c}`).join('\n') : '(none)';
  return `Earlier messages:\n${ctx}\n\nCURRENT message from the contact:\n"""${current}"""\n\nReturn JSON.`;
}
