import { describe, expect, it } from 'vitest';
import { judgeSummary, parseJudge } from './judge';
import { scoreContact } from './risk';
import type { TaggedMessage } from './types';

const t = (id: string, day: number, tactic: TaggedMessage['hits'][number]['tactic'], evidence: string): TaggedMessage => ({
  messageId: id, contactId: 'c', sentAt: Date.UTC(2026, 8, 14) + day * 86_400_000, hits: [{ tactic, evidence }], route: 'on_device', latencyMs: 0,
});

describe('judge summary', () => {
  const risk = scoreContact('c', [
    t('1', 0, 'unverifiable_persona', 'I am Mark, an engineer on an oil rig'),
    t('2', 1, 'love_bombing', 'You are my queen, Margaret'),
    t('3', 15, 'payment_request', 'Margaret, send it to mark.e@example.com or call +44 7700 900123'),
  ]);
  const s = judgeSummary(risk, { names: ['Margaret', 'Mark'], channel: 'Email' });

  it('redacts names, emails and phones consistently across lines', () => {
    expect(s).not.toMatch(/Margaret|mark\.e@|7700/);
    expect(s.match(/\[PERSON_1\]/g)?.length).toBe(2); // Margaret (longest name first), same placeholder both times
    expect(s.match(/\[PERSON_2\]/g)?.length).toBe(1); // Mark
    expect(s).toMatch(/\[EMAIL_1\]/);
  });

  it('keeps the order of the arc', () => {
    expect(s.indexOf('Day 1:')).toBeLessThan(s.indexOf('Day 16:'));
  });

  it('parses messy model output defensively', () => {
    const r = parseJudge('```json\n{"verdict":"likely_scam","summary":"x","checks":[{"claim":"a","finding":"b"},{}],"questions":["q1","q2","q3","q4"]}\n```');
    expect(r.verdict).toBe('likely_scam');
    expect(r.checks).toHaveLength(1);
    expect(r.questions).toHaveLength(3);
    expect(parseJudge('nonsense').verdict).toBe('unclear');
  });
});
