import { describe, expect, it } from 'vitest';
import { applyTagged, emptyRisk, isOrderedArc } from './risk';
import type { TacticId } from './tactics';
import type { TaggedMessage } from './types';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 10, 1);

const tagged = (day: number, ...tactics: TacticId[]): TaggedMessage => ({
  messageId: `m${day}-${tactics.join()}`,
  contactId: 'c',
  sentAt: t0 + day * DAY,
  hits: tactics.map((tactic) => ({ tactic, evidence: tactic })),
  route: 'on_device',
  latencyMs: 1,
});

const run = (...msgs: TaggedMessage[]) => msgs.reduce((r, m) => applyTagged(r, m), emptyRisk('c', t0));

describe('risk engine', () => {
  it('stays clear for normal chat', () => {
    const r = run(tagged(0), tagged(1), tagged(2));
    expect(r.score).toBe(0);
    expect(r.level).toBe('clear');
    expect(r.messagesScanned).toBe(3);
  });

  it('a single rapport tactic is only a watch at most', () => {
    const r = run(tagged(0, 'love_bombing'));
    expect(['clear', 'watch']).toContain(r.level);
    expect(r.shouldEscalate).toBe(false);
  });

  it('a full long-con arc escalates', () => {
    const r = run(
      tagged(0, 'love_bombing', 'unverifiable_persona'),
      tagged(4, 'move_off_platform'),
      tagged(9, 'secrecy_request'),
      tagged(15, 'investment_pitch'),
      tagged(21, 'payment_request', 'risky_payment_method'),
    );
    expect(r.level).toBe('danger');
    expect(r.shouldEscalate).toBe(true);
    expect(r.stageReached).toBe('extraction');
    expect(r.timeline.at(-1)?.day).toBe(21);
  });

  it('escalation is sticky once crossed', () => {
    const r = run(
      tagged(0, 'impersonation', 'urgency_pressure'),
      tagged(0, 'payment_request', 'risky_payment_method'),
    );
    expect(r.shouldEscalate).toBe(true);
    const later = applyTagged(r, tagged(3));
    expect(later.shouldEscalate).toBe(true);
  });

  it('the same arc scores higher in order than shuffled', () => {
    const ordered = run(tagged(0, 'love_bombing'), tagged(5, 'secrecy_request'), tagged(10, 'crisis_story'));
    const shuffled = run(tagged(0, 'crisis_story'), tagged(5, 'secrecy_request'), tagged(10, 'love_bombing'));
    expect(isOrderedArc(ordered.timeline)).toBe(true);
    expect(isOrderedArc(shuffled.timeline)).toBe(false);
    expect(ordered.score).toBeGreaterThan(shuffled.score);
  });
});
