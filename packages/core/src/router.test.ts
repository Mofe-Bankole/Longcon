import { describe, expect, it } from 'vitest';
import { memoryCache, Router, type Tagger } from './router';
import type { ChatMessage, ContactRisk } from './types';

const DAY = 86_400_000;
const msg = (id: string, day: number, text: string, contactId = 'mark', fromUser = false): ChatMessage => ({
  id, contactId, fromUser, text, sentAt: Date.UTC(2026, 10, 1) + day * DAY, source: 'demo',
});

const ARC = [
  msg('1', 0, 'God brought you into my life for a reason'),
  msg('2', 0, 'Thank you, that is kind', 'mark', true),
  msg('3', 4, 'Add me on Telegram, I barely use this app'),
  msg('4', 9, "Don't tell your children about us yet"),
  msg('5', 21, 'Send it as USDT TRC20, it is faster'),
];

/** A fake model that confirms rules hits and records each call. */
function fakeTagger(calls: string[][], route: 'on_device' | 'in_cloud' = 'on_device'): Tagger {
  return {
    async tag(msgs) {
      calls.push(msgs.map((m) => m.id));
      const { rulesTag } = await import('./rules');
      return msgs.map((m) => ({ messageId: m.id, contactId: m.contactId, sentAt: m.sentAt, hits: rulesTag(m.text), route, latencyMs: 400 }));
    },
  };
}

describe('router', () => {
  it('shows a rules verdict before any model call', async () => {
    const seen: ContactRisk[] = [];
    const r = new Router({ events: { onContact: (c) => seen.push(c) } });
    await r.ingest(ARC);
    const c = r.contact('mark')!;
    // Keyword hits alone are discounted: a warning, never a confirmed danger.
    expect(c.level).toBe('warning');
    expect(c.routes.rules).toBeGreaterThan(0);
    expect(c.routes.on_device).toBe(0);
    expect(c.messagesScanned).toBe(4); // the user's own message is not labelled
    expect(seen.length).toBe(1);
  });

  it('batches model calls and replaces rules results', async () => {
    const calls: string[][] = [];
    const r = new Router({ tagger: fakeTagger(calls), batchSize: 3 });
    await r.ingest(ARC);
    await r.idle();
    expect(calls).toEqual([['1', '3', '4'], ['5']]);
    const c = r.contact('mark')!;
    expect(c.routes.rules).toBe(0);
    expect(c.routes.on_device).toBe(c.timeline.length);
    expect(r.latency.summary('on_device').p50).toBe(400);
  });

  it('never labels a cached message twice', async () => {
    const calls: string[][] = [];
    const cache = memoryCache();
    const a = new Router({ tagger: fakeTagger(calls), cache });
    await a.ingest(ARC);
    await a.idle();
    const b = new Router({ tagger: fakeTagger(calls), cache });
    await b.ingest(ARC);
    await b.idle();
    expect(calls.flat().length).toBe(4);
    expect(b.contact('mark')!.routes.on_device).toBeGreaterThan(0);
  });

  it('keeps rules results when the model fails, and resumes', async () => {
    let errors = 0;
    const failing: Tagger = { tag: async () => { throw new Error('AI/api-not-enabled'); } };
    const r = new Router({ tagger: failing, events: { onModelError: () => errors++ } });
    await r.ingest(ARC);
    await r.idle();
    expect(errors).toBe(1);
    expect(r.pending()).toBe(4);
    expect(r.contact('mark')!.level).toBe('warning');
    r.resume(fakeTagger([]));
    await r.idle();
    expect(r.pending()).toBe(0);
    expect(r.contact('mark')!.routes.rules).toBe(0);
    expect(r.contact('mark')!.level).toBe('danger');
  });

  it('escalates once, riskiest contact first', async () => {
    const escalated: string[] = [];
    const calls: string[][] = [];
    const r = new Router({ tagger: fakeTagger(calls), events: { onEscalate: (c) => escalated.push(c.contactId) } });
    await r.ingest([msg('g1', 0, 'Happy birthday Grandma!', 'sam'), ...ARC]);
    await r.idle();
    expect(calls[0]![0]).toBe('1');
    expect(escalated).toEqual(['mark']);
  });
});
