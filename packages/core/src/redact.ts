/**
 * Local redaction applied before anything is escalated to the cloud.
 *
 * We redact identifiers of the *user* and of private third parties. We keep things
 * the cloud judge needs to verify the scam: domains, platform and company names,
 * and crypto wallet addresses (these belong to the scammer, and are checkable).
 */
export interface RedactionResult {
  text: string;
  /** placeholder → original. Never leaves the device. */
  map: Record<string, string>;
  counts: Record<string, number>;
}

interface Rule {
  kind: string;
  re: RegExp;
}

const RULES: Rule[] = [
  { kind: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // Cards: 13–19 digits with optional spaces/dashes.
  { kind: 'CARD', re: /\b(?:\d[ -]?){12,18}\d\b/g },
  // Phone numbers: international or local, at least 7 digits overall.
  { kind: 'PHONE', re: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}\b/g },
  // Bank/account-like numbers, NUBAN (10 digits), SSN-ish patterns.
  { kind: 'ACCOUNT', re: /\b\d{3}-\d{2}-\d{4}\b|\b\d{8,12}\b/g },
  // OTP-like short codes when introduced by a code word.
  { kind: 'CODE', re: /\b(?:otp|code|pin|password)\b[^\d\n]{0,12}(\d{4,8})\b/gi },
];

export function redact(input: string, names: string[] = []): RedactionResult {
  const map: Record<string, string> = {};
  const reverse = new Map<string, string>();
  const counts: Record<string, number> = {};
  let text = input;

  const placeholder = (kind: string, original: string) => {
    const key = `${kind}:${original}`;
    const existing = reverse.get(key);
    if (existing) return existing;
    counts[kind] = (counts[kind] ?? 0) + 1;
    const ph = `[${kind}_${counts[kind]}]`;
    map[ph] = original;
    reverse.set(key, ph);
    return ph;
  };

  // Emails first, so a name inside an address ("mark.e@…") doesn't break the address apart.
  text = text.replace(RULES[0]!.re, (m) => placeholder('EMAIL', m));

  // Known names next (the user's own name, family members), longest first.
  for (const name of [...names].filter(Boolean).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${escapeRe(name)}\\b`, 'gi');
    text = text.replace(re, (m) => placeholder('PERSON', m));
  }

  for (const { kind, re } of RULES.slice(1)) {
    text = text.replace(re, (m, group?: string) => {
      if (m.startsWith('[')) return m;
      if (kind === 'PHONE' && digits(m) < 7) return m;
      if (kind === 'CODE' && typeof group === 'string') return m.replace(group, placeholder(kind, group));
      return placeholder(kind, m);
    });
  }
  return { text, map, counts };
}

export function rehydrate(text: string, map: Record<string, string>): string {
  return text.replace(/\[[A-Z]+_\d+\]/g, (ph) => map[ph] ?? ph);
}

export function totalRedacted(r: RedactionResult): number {
  return Object.values(r.counts).reduce((a, b) => a + b, 0);
}

const digits = (s: string) => (s.match(/\d/g) ?? []).length;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
