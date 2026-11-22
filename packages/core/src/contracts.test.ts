/**
 * Golden vectors shared with the Kotlin app (contracts/vectors/*.json).
 * `GEN_VECTORS=1 pnpm --filter @longcon/core test` regenerates them from the TS engine;
 * a normal run checks TS still matches them. Kotlin runs the same files.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contactHash, importHouseholdKey, normaliseHandle } from './hash';
import { scoreContact } from './risk';
import { rulesTag } from './rules';
import type { TacticId } from './tactics';
import type { Route, TaggedMessage } from './types';

const DIR = fileURLToPath(new URL('../../../contracts/vectors/', import.meta.url));
const GEN = process.env.GEN_VECTORS === '1';
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1);

function golden<T>(name: string, compute: () => Promise<T> | T) {
  return async () => {
    const actual = await compute();
    if (GEN) writeFileSync(DIR + name, JSON.stringify(actual, null, 2) + '\n');
    else expect(actual).toEqual(JSON.parse(readFileSync(DIR + name, 'utf8')));
  };
}

type Step = [day: number, route: Route, ...tactics: TacticId[]];
const RISK_CASES: Record<string, Step[]> = {
  normal_chat: [[0, 'on_device'], [1, 'on_device'], [2, 'on_device']],
  single_love_bombing: [[0, 'on_device', 'love_bombing']],
  romance_full_arc: [
    [0, 'on_device', 'love_bombing', 'unverifiable_persona'],
    [4, 'on_device', 'move_off_platform'],
    [9, 'on_device', 'secrecy_request'],
    [15, 'on_device', 'investment_pitch'],
    [21, 'on_device', 'payment_request', 'risky_payment_method'],
  ],
  romance_rules_only: [
    [0, 'rules', 'love_bombing', 'unverifiable_persona'],
    [4, 'rules', 'move_off_platform'],
    [9, 'rules', 'secrecy_request'],
    [21, 'rules', 'payment_request', 'risky_payment_method'],
  ],
  mixed_routes_confirm: [
    [0, 'rules', 'risky_payment_method'],
    [1, 'on_device', 'risky_payment_method'],
    [1, 'rules', 'urgency_pressure'],
  ],
  impersonation_same_day: [[0, 'on_device', 'impersonation', 'urgency_pressure'], [0, 'in_cloud', 'payment_request', 'risky_payment_method']],
  shuffled_arc: [[0, 'on_device', 'crisis_story'], [5, 'on_device', 'secrecy_request'], [10, 'on_device', 'love_bombing']],
  ordered_arc: [[0, 'on_device', 'love_bombing'], [5, 'on_device', 'secrecy_request'], [10, 'on_device', 'crisis_story']],
  repeats: [[0, 'on_device', 'urgency_pressure'], [1, 'on_device', 'urgency_pressure'], [2, 'on_device', 'urgency_pressure'], [3, 'on_device', 'urgency_pressure']],
  job_scam: [[0, 'on_device', 'job_offer_bait'], [1, 'on_device', 'move_off_platform'], [3, 'on_device', 'job_offer_bait', 'payment_request']],
  otp_grab: [[0, 'on_device', 'impersonation'], [0, 'on_device', 'credential_request', 'urgency_pressure']],
};

const RULES_CASES = [
  'God brought you into my life for a reason ❤️',
  "I'm an engineer on an oil rig in the North Sea, contract ends in 3 months",
  'Add me on Telegram, I barely use this app',
  "Don't tell your children about us yet, they won't understand",
  'My uncle trades crypto, guaranteed returns of 30% weekly',
  'My account was frozen, I need to pay customs fees today only',
  'Send it as USDT TRC20 to this wallet, it is faster',
  'Hi mum, this is my new number. My phone broke',
  'Read me the 6-digit code you just got',
  'Earn from home, rate products and earn $300 a day, no experience needed',
  'Can you send me the money by tonight? I will pay you back',
  'See you at church on Sunday, bring the casserole dish!',
  'The quarterly report is attached. Let me know your thoughts.',
  'Happy birthday Grandma! Love you lots',
];

const HASH_SECRET = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const HASH_CASES = [
  'Mark.Engineer@Example.com',
  '  mark.engineer@example.com ',
  '+44 7700 900123',
  '+447700900123',
  '(0803) 123-4567',
  '@Eng_Mark',
  'eng_mark',
  'Mark Williams',
];

describe('contract vectors', () => {
  it(
    'risk engine',
    golden('risk.json', () =>
      Object.entries(RISK_CASES).map(([name, steps]) => {
        const tagged: TaggedMessage[] = steps.map(([day, route, ...tactics], i) => ({
          messageId: `m${i}`,
          contactId: 'c',
          sentAt: T0 + day * DAY,
          hits: tactics.map((tactic) => ({ tactic, evidence: tactic })),
          route,
          latencyMs: 0,
        }));
        const r = scoreContact('c', tagged);
        return {
          name,
          input: tagged.map(({ messageId, sentAt, route, hits }) => ({ messageId, sentAt, route, tactics: hits.map((h) => h.tactic) })),
          expect: { score: r.score, level: r.level, stageReached: r.stageReached, shouldCheck: r.shouldCheck, shouldEscalate: r.shouldEscalate, days: r.timeline.map((e) => e.day) },
        };
      }),
    ),
  );

  it('rules prefilter', golden('rules.json', () => RULES_CASES.map((text) => ({ text, tactics: rulesTag(text).map((h) => h.tactic) }))));

  it(
    'contact hash',
    golden('hash.json', async () => {
      const key = await importHouseholdKey(HASH_SECRET);
      return {
        secretHex: HASH_SECRET,
        cases: await Promise.all(HASH_CASES.map(async (handle) => ({ handle, normalised: normaliseHandle(handle), hash: await contactHash(key, handle) }))),
      };
    }),
  );
});
