import { describe, expect, it } from 'vitest';
import { parseChat } from './chatImport';

describe('parseChat', () => {
  it('reads a WhatsApp Android export (day-first, 24h) with continuations and system lines', () => {
    const r = parseChat(
      [
        '14/09/2026, 18:05 - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.',
        '14/09/2026, 18:05 - Mark: Hello Margaret, forgive me for writing.',
        'I had to say hello.',
        '14/09/2026, 18:31 - Margaret: Do I know you?',
        '30/09/2026, 09:00 - Mark: Send it as USDT TRC20',
      ].join('\n'),
    );
    expect(r.format).toBe('whatsapp');
    expect(r.messages).toHaveLength(3);
    expect(r.messages[0]!.text).toBe('Hello Margaret, forgive me for writing.\nI had to say hello.');
    expect(r.senders).toEqual(['Mark', 'Margaret']);
    expect(new Date(r.messages[2]!.sentAt).getDate()).toBe(30);
    expect(r.datesKnown).toBe(true);
  });

  it('reads a WhatsApp iOS export (brackets, seconds, 12-hour, month-first)', () => {
    const r = parseChat(['[9/14/26, 6:05:12 PM] Mark: Hi', '[9/15/26, 9:01:00 AM] Margaret: Morning'].join('\n'));
    expect(r.format).toBe('whatsapp');
    const d = new Date(r.messages[0]!.sentAt);
    expect([d.getMonth() + 1, d.getDate(), d.getHours(), d.getFullYear()]).toEqual([9, 14, 18, 2026]);
  });

  it('uses the locale preference when dates are ambiguous', () => {
    const txt = '03/04/2026, 10:00 - A: one\n03/04/2026, 10:01 - B: two';
    expect(new Date(parseChat(txt).messages[0]!.sentAt).getMonth()).toBe(3); // 3 April (day-first default)
    expect(new Date(parseChat(txt, { monthFirst: true }).messages[0]!.sentAt).getMonth()).toBe(2); // 4 March
  });

  it('reads year-first dates', () => {
    const d = new Date(parseChat('2026-09-14, 18:05 - Mark: Hi\n2026-09-15, 09:00 - Me: Yo').messages[0]!.sentAt);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 14]);
  });

  it('reads plain "Name: text" lines without dates', () => {
    const r = parseChat('Mark: hello\nMe: hi\nMark: add me on telegram', { now: 1_000_000_000 });
    expect(r.format).toBe('lines');
    expect(r.messages.map((m) => m.sender)).toEqual(['Mark', 'Me', 'Mark']);
    expect(r.messages[1]!.sentAt - r.messages[0]!.sentAt).toBe(60_000);
    expect(r.datesKnown).toBe(false);
  });

  it('treats free text as paragraphs from the other person', () => {
    const r = parseChat('Dear Grace,\nYour CV was shortlisted.\n\nPlease pay the training fee by gift card.');
    expect(r.format).toBe('paragraphs');
    expect(r.messages).toHaveLength(2);
    expect(r.senders).toEqual(['Them']);
  });
});
