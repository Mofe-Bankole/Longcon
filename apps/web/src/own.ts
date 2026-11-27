import { parseChat, type ChatMessage, type ImportResult } from '@longcon/core';
import { CONVERSATIONS, type DemoConversation } from './corpus';
import { state } from './engine';
import { esc } from './panel';

/**
 * "Check your own conversation": paste a chat or open a WhatsApp export. Parsed in the browser;
 * the text goes nowhere unless the person has allowed cloud checking (same rules as the demo).
 */
const MAX = 300;
let counter = 0;

export function renderImport(root: HTMLElement, onDone: (conv: DemoConversation) => void, onCancel: () => void): void {
  root.innerHTML = `
    <div class="import">
      <h2>Check your own conversation</h2>
      <p class="import__lead">Paste the messages, or open a chat you exported from WhatsApp. ${privacyLine()}</p>
      <textarea class="import__text" rows="9" placeholder="Paste a chat or an email here…" aria-label="Conversation text"></textarea>
      <div class="import__row">
        <label class="btn btn--ghost import__file">Open a WhatsApp export (.txt)<input type="file" accept=".txt,text/plain" hidden></label>
        <details class="import__help"><summary>How do I export a WhatsApp chat?</summary>
          <p>On the phone, open the chat → <b>⋮</b> (Android) or the contact's name (iPhone) → <b>Export chat</b> →
          <b>Without media</b>. Send it to yourself, then open it here. On iPhone it arrives as a .zip: open it in Files first to get the .txt.</p>
        </details>
      </div>
      <div class="import__who"></div>
      <p class="import__err" role="alert"></p>
      <div class="import__row">
        <button class="btn btn--primary" data-act="next">Next</button>
        <button class="btn btn--ghost" data-act="cancel">Cancel</button>
      </div>
    </div>`;

  const ta = root.querySelector<HTMLTextAreaElement>('.import__text')!;
  const who = root.querySelector<HTMLElement>('.import__who')!;
  const err = root.querySelector<HTMLElement>('.import__err')!;
  const next = root.querySelector<HTMLButtonElement>('[data-act=next]')!;
  let parsed: ImportResult | undefined;

  root.querySelector<HTMLInputElement>('input[type=file]')!.onchange = async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (/\.zip$/i.test(f.name)) return void (err.textContent = 'That is a .zip. Open it first and choose the .txt file inside.');
    ta.value = await f.text();
    step();
  };
  root.querySelector<HTMLButtonElement>('[data-act=cancel]')!.onclick = onCancel;
  next.onclick = () => (parsed && who.childElementCount ? finish() : step());
  ta.oninput = () => {
    parsed = undefined;
    who.replaceChildren();
    next.textContent = 'Next';
  };

  function step(): void {
    err.textContent = '';
    if (!ta.value.trim()) return void (err.textContent = 'Paste a conversation first.');
    parsed = parseChat(ta.value, { monthFirst: navigator.language === 'en-US' });
    if (!parsed.messages.length) return void (err.textContent = "We couldn't find any messages in that text.");
    const s = parsed.senders;
    if (s.length >= 2) {
      who.innerHTML = `<fieldset><legend>Found ${parsed.messages.length} messages. <b>Which one is you?</b></legend>
        ${s.slice(0, 6).map((n, i) => `<label class="radio"><input type="radio" name="me" value="${esc(n)}" ${i === 1 ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</fieldset>`;
    } else {
      who.innerHTML = `<label class="field">Found ${parsed.messages.length} message${parsed.messages.length === 1 ? '' : 's'}. Who sent ${parsed.messages.length === 1 ? 'it' : 'them'}?
        <input type="text" name="them" placeholder="Their name" value="${s[0] === 'Them' ? '' : esc(s[0] ?? '')}"></label>`;
    }
    next.textContent = 'Check this conversation';
  }

  function finish(): void {
    const p = parsed!;
    const me = who.querySelector<HTMLInputElement>('input[name=me]:checked')?.value;
    const typed = who.querySelector<HTMLInputElement>('input[name=them]')?.value.trim();
    const others = p.senders.filter((n) => n !== me);
    const contactName = typed || (me ? others[0] : p.senders[0] !== 'Them' ? p.senders[0] : undefined) || 'This person';
    const id = `own-${++counter}`;
    const msgs = p.messages.slice(-MAX);
    const channel = p.format === 'whatsapp' ? 'whatsapp' : 'pasted';
    const messages: ChatMessage[] = msgs.map((m, i) => ({
      id: `${id}-${i}`,
      contactId: id,
      fromUser: me !== undefined && m.sender === me,
      text: m.text,
      sentAt: m.sentAt,
      source: channel,
    }));
    const span = Math.max(1, Math.ceil((messages.at(-1)!.sentAt - messages[0]!.sentAt) / 86_400_000) + 1);
    const conv: DemoConversation = {
      id,
      label: 'own',
      userName: me ?? 'You',
      contactName: others.length > 1 && me ? `${contactName} +${others.length - 1}` : contactName,
      initial: contactName[0]!.toUpperCase(),
      channels: [channel],
      spanDays: span,
      description: '',
      messages,
      expected: new Map(),
    };
    CONVERSATIONS.unshift(conv);
    onDone(conv);
  }
}

function privacyLine(): string {
  if (state.status === 'ready') return '<b>It is checked here, on this computer. Nothing is uploaded.</b>';
  if (state.cloudConsent) return '<b>This computer can’t run the private model, and you’ve allowed Google to check messages, so the text will be sent to Google.</b> Untick the box at the top to keep it here (quick check only).';
  return '<b>Nothing is uploaded.</b> This computer can’t run the private model, so Longcon will do the quick check only.';
}
