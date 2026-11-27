/**
 * Turn a pasted chat or a WhatsApp "Export chat" .txt into messages. Runs entirely in the browser.
 *
 * Supported:
 * - WhatsApp Android: `27/11/2026, 10:15 - Mark: text`  (also 12-hour `10:15 pm`, 2-digit years, `.` or `-` dates)
 * - WhatsApp iOS:     `[27/11/2026, 10:15:32] Mark: text`
 * - Plain "Name: text" lines (no dates): spaced one minute apart
 * - Anything else: each paragraph becomes one message from the other person (e.g. a pasted email)
 * Continuation lines are appended to the previous message. System lines ("Messages are end-to-end encrypted") are dropped.
 */
export interface ImportedMessage {
  sender: string;
  text: string;
  /** Epoch millis; synthetic (one minute apart) when the source had no dates. */
  sentAt: number;
}

export interface ImportResult {
  format: 'whatsapp' | 'lines' | 'paragraphs';
  messages: ImportedMessage[];
  /** Senders by message count, most first. */
  senders: string[];
  datesKnown: boolean;
}

const WA = /^‎?\[?(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4}),? (\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s?([apAP]\.?\s?[mM]\.?)?\]?(?: -|:)? ([^:]{1,60}?): ([\s\S]*)$/;
const NAME_LINE = /^([^:\n]{1,40}): (.+)$/;
const SYSTEM = /end-to-end encrypted|created group|added you|changed the subject|left$|joined using|security code changed|<Media omitted>|This message was deleted/i;
const MINUTE = 60_000;

export function parseChat(raw: string, opts: { monthFirst?: boolean; now?: number } = {}): ImportResult {
  const text = raw.replace(/\r\n?/g, '\n').replace(/[  ]/g, ' ').trim();
  const lines = text.split('\n');
  const waHits = lines.filter((l) => WA.test(l)).length;

  if (waHits >= 2 || (waHits === 1 && lines.length <= 3)) return finish('whatsapp', parseWhatsApp(lines, opts.monthFirst), true);

  const nameHits = lines.filter((l) => NAME_LINE.test(l)).length;
  const now = opts.now ?? Date.now();
  if (nameHits >= 2 && nameHits >= lines.filter((l) => l.trim()).length * 0.5) {
    const out: ImportedMessage[] = [];
    for (const l of lines) {
      const m = NAME_LINE.exec(l);
      if (m) out.push({ sender: m[1]!.trim(), text: m[2]!.trim(), sentAt: 0 });
      else if (l.trim() && out.length) out.at(-1)!.text += `\n${l.trim()}`;
    }
    return finish('lines', spaced(out, now), false);
  }

  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return finish('paragraphs', spaced(paras.map((p) => ({ sender: 'Them', text: p, sentAt: 0 })), now), false);
}

function parseWhatsApp(lines: string[], monthFirstPref?: boolean): ImportedMessage[] {
  const rows: { a: number; b: number; y: number; h: number; min: number; s: number; ampm?: string; sender: string; text: string }[] = [];
  for (const l of lines) {
    const m = WA.exec(l);
    if (m) {
      let [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (a > 31) [a, b, y] = [y, b, a]; // year-first (2026-09-14) → day, month, year
      rows.push({ a, b, y: y < 100 ? 2000 + y : y, h: Number(m[4]), min: Number(m[5]), s: Number(m[6] ?? 0), ampm: m[7], sender: m[8]!.trim(), text: m[9]!.trim() });
    } else if (l.trim() && rows.length) rows.at(-1)!.text += `\n${l.trim()}`;
  }
  // Day-first or month-first? Decide from the data, else the caller's locale preference.
  const monthFirst = rows.some((r) => r.b > 12) ? true : rows.some((r) => r.a > 12) ? false : (monthFirstPref ?? false);
  return rows
    .filter((r) => !SYSTEM.test(r.text) && r.text)
    .map((r) => {
      const [day, month] = monthFirst ? [r.b, r.a] : [r.a, r.b];
      let h = r.h % 12;
      if (r.ampm ? /p/i.test(r.ampm) : false) h += 12;
      if (!r.ampm) h = r.h;
      return { sender: r.sender, text: r.text, sentAt: new Date(r.y, month - 1, day, h, r.min, r.s).getTime() };
    });
}

function spaced(msgs: ImportedMessage[], now: number): ImportedMessage[] {
  return msgs.map((m, i) => ({ ...m, sentAt: now - (msgs.length - i) * MINUTE }));
}

function finish(format: ImportResult['format'], messages: ImportedMessage[], datesKnown: boolean): ImportResult {
  const counts = new Map<string, number>();
  for (const m of messages) counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1);
  return { format, messages, senders: [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([s]) => s), datesKnown };
}
