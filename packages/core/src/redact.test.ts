import { describe, expect, it } from 'vitest';
import { parseHits } from './ai';
import { redact, rehydrate, totalRedacted } from './redact';

describe('redact', () => {
  it('removes personal identifiers but keeps scam evidence (domains, wallets)', () => {
    const input =
      'Hi Grace Okafor, send 500 USDT to TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE on vexacoin-pro.io. ' +
      'My number is +234 803 555 0199, email grace.o@gmail.com, acct 0123456789, your OTP is 482913';
    const r = redact(input, ['Grace Okafor']);
    expect(r.text).not.toContain('Grace Okafor');
    expect(r.text).not.toContain('803 555 0199');
    expect(r.text).not.toContain('grace.o@gmail.com');
    expect(r.text).not.toContain('0123456789');
    expect(r.text).not.toContain('482913');
    expect(r.text).toContain('vexacoin-pro.io');
    expect(r.text).toContain('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE');
    expect(totalRedacted(r)).toBeGreaterThanOrEqual(5);
    expect(rehydrate(r.text, r.map)).toBe(input);
  });

  it('uses the same placeholder for repeated values', () => {
    const r = redact('call 08035550199 or 08035550199');
    expect(r.text.match(/\[PHONE_1\]/g)).toHaveLength(2);
  });

  it('leaves amounts and short numbers alone', () => {
    const r = redact('It costs $340 and arrives in 3 days, 2026');
    expect(r.text).toBe('It costs $340 and arrives in 3 days, 2026');
  });
});

describe('parseHits', () => {
  it('drops unknown tactics and duplicates, tolerates wrapping', () => {
    const raw = 'Sure! ```json\n{"hits":[{"tactic":"secrecy_request","evidence":"dont tell"},{"tactic":"made_up","evidence":"x"},{"tactic":"secrecy_request","evidence":"again"}]}\n```';
    expect(parseHits(raw, 'msg')).toEqual([{ tactic: 'secrecy_request', evidence: 'dont tell' }]);
  });
  it('returns [] on garbage', () => {
    expect(parseHits('nope', 'msg')).toEqual([]);
  });
});
