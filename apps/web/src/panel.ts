import { TACTICS, topSigns, verdictFor, type ContactRisk, type TacticId } from '@longcon/core';
import { JUDGE_LABEL, renderArc, routeBadge } from '@longcon/ui';
import type { DemoConversation } from './corpus';
import { CHANNEL_NAMES } from './corpus';
import { router, runJudge, state } from './engine';

/**
 * The Longcon panel for the protected person: the Arc, one plain sentence, one action,
 * the evidence, and the second opinion. The same layout as the extension side panel.
 */
export function renderPanel(root: HTMLElement, conv: DemoConversation, fed: number): void {
  const risk = router.contact(conv.id);
  root.className = 'panel lc-large';
  // Keep the Arc element (so its segments animate) and the opinion card (so open details stay open).
  const sameConv = root.dataset.conv === conv.id;
  root.dataset.conv = conv.id;
  const oldArc = sameConv ? root.querySelector<HTMLElement>('.panel__arc') : null;
  const oldOpinion = sameConv ? root.querySelector<HTMLElement>('.opinion') : null;

  if (!risk || fed === 0) {
    root.innerHTML = `
      <p class="panel__eyebrow">Longcon</p>
      <h2 class="panel__title">Watching for the long game</h2>
      <p class="panel__lead">Press <b>Play</b> to watch ${conv.spanDays} days of messages between ${conv.userName}
        and ${conv.contactName} arrive. Longcon checks each one as it comes in, privately.</p>
      <div class="panel__arc"></div>`;
    renderArc({ timeline: [] }, adopt(root, '.panel__arc', oldArc));
    return;
  }

  const v = verdictFor(risk, firstName(conv.contactName));
  const pending = router.pendingFor(conv.id);
  const onDevice = risk.routes.on_device;
  const tagsShown = [...router.tagsFor(conv.id).values()];
  const scanned = tagsShown.length;
  const checkedPrivately = tagsShown.filter((t) => t.route === 'on_device').length;
  const lat = router.latency.summary(state.cloudConsent && state.status !== 'ready' ? 'in_cloud' : 'on_device');

  root.innerHTML = `
    <p class="panel__eyebrow">${esc(conv.contactName)} · ${conv.channels.map((c) => CHANNEL_NAMES[c]).join(' → ')}</p>
    <h2 class="panel__title level-${v.level}">${v.title}</h2>
    <div class="panel__arc"></div>
    <p class="panel__sentence">${esc(v.sentence)}</p>
    <p class="panel__action">${esc(v.action)}</p>
    <div class="panel__buttons">
      <button class="btn btn--ghost" data-act="speak">🔊 Read this to me</button>
    </div>
    <section class="signs"></section>
    <section class="opinion"></section>
    <footer class="panel__foot">
      <span class="foot__route"></span>
      <span>${scanned} message${scanned === 1 ? '' : 's'} checked${checkedPrivately ? `, ${checkedPrivately} privately on this computer` : ''}${
        lat.n ? ` · typically ${fmtMs(lat.p50)} each` : ''
      }</span>
      ${pending && !state.modelError ? `<span class="foot__pending"><span class="shimmer"></span>Checking ${pending} more${state.status === 'ready' ? ' privately' : ' with Google'}…</span>` : ''}
    </footer>`;

  renderArc(risk, adopt(root, '.panel__arc', oldArc));
  root.querySelector('.foot__route')!.append(routeBadge(onDevice ? 'on_device' : risk.routes.in_cloud ? 'in_cloud' : 'rules'));
  renderSigns(root.querySelector('.signs')!, risk);
  const j = state.judge.get(conv.id);
  const opinionKey = `${risk.shouldEscalate}:${j?.phase ?? 'none'}`;
  if (oldOpinion && oldOpinion.dataset.key === opinionKey) adopt(root, '.opinion', oldOpinion);
  else {
    const el = root.querySelector<HTMLElement>('.opinion')!;
    el.dataset.key = opinionKey;
    renderOpinion(el, risk, conv);
  }

  root.querySelector<HTMLButtonElement>('[data-act=speak]')!.onclick = () => speak(`${v.title}. ${v.sentence} ${v.action}`);
}

function renderSigns(el: Element, risk: ContactRisk): void {
  const top = topSigns(risk, 3);
  if (!top.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `<h3 class="section-title">What Longcon noticed</h3>`;
  const list = document.createElement('ol');
  list.className = 'sign-list';
  for (const t of top) list.append(signItem(risk, t));
  el.append(list);
}

function signItem(risk: ContactRisk, t: TacticId): HTMLElement {
  const events = risk.timeline.filter((e) => e.tactic === t);
  const last = events.at(-1)!;
  const li = document.createElement('li');
  li.className = `sign stage-${TACTICS[t].stage}`;
  li.innerHTML = `
    <div class="sign__head"><span class="sign__dot"></span><b>${esc(TACTICS[t].plain)}</b>
      <span class="sign__day">Day ${last.day + 1}${events.length > 1 ? ` · ${events.length}×` : ''}</span></div>
    <blockquote class="sign__quote">“${esc(last.evidence)}”</blockquote>`;
  li.append(routeBadge(last.route));
  return li;
}

function renderOpinion(el: Element, risk: ContactRisk, conv: DemoConversation): void {
  const j = state.judge.get(conv.id);
  if (!risk.shouldEscalate && !j) {
    el.innerHTML = '';
    return;
  }
  if (!j) {
    el.innerHTML = `
      <div class="opinion__ask">
        <p><b>Want a second opinion?</b> Google can check the claims in this pattern, like company names and websites.
        <span class="muted">Only the warning signs are sent, each with a short quote, with names, emails and numbers removed. Never the conversation. You can see exactly what was sent.</span></p>
        <button class="btn btn--primary" data-act="judge">Get a second opinion</button>
      </div>`;
    el.querySelector<HTMLButtonElement>('[data-act=judge]')!.onclick = () =>
      runJudge(risk, [conv.userName, firstName(conv.contactName)], conv.channels.map((c) => CHANNEL_NAMES[c]).join(' then '));
    return;
  }
  if (j.phase === 'running') {
    el.innerHTML = `
      <div class="opinion__running">
        <ol class="steps"><li class="done">Removing your private details</li><li class="active">Asking Google to check the claims</li><li>Writing the answer</li></ol>
      </div>`;
    return;
  }
  if (j.phase === 'error' || !j.result) {
    el.innerHTML = `<p class="opinion__error">${esc(j.error ?? 'No second opinion right now.')}</p>`;
    return;
  }
  const r = j.result;
  const verdictText = { likely_scam: 'Very likely a scam', unclear: 'Not sure', likely_safe: 'Probably genuine' }[r.verdict];
  el.innerHTML = `
    <div class="opinion__card verdict-${r.verdict}">
      <h3 class="section-title">Second opinion: ${verdictText}</h3>
      <p class="opinion__summary">${esc(r.summary)}</p>
      ${r.grounded ? '' : `<p class="muted small">Google Search wasn't available for this check, so this opinion comes from Gemini alone and hasn't been verified on the web.</p>`}
      ${r.checks.length ? `<h4>${r.grounded ? 'What Google checked' : 'Claims to be careful about'}</h4><ul class="checks">${r.checks.map((c) => `<li><b>${esc(c.claim)}</b><br>${esc(c.finding)}</li>`).join('')}</ul>` : ''}
      ${r.questions.length ? `<h4>Ask ${esc(firstName(conv.contactName))}</h4><ol class="questions">${r.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>` : ''}
      <div class="search-entry"></div>
      ${r.sources.length ? `<p class="sources">Sources: ${r.sources.map((s) => `<a href="${attr(s.uri)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(' · ')}</p>` : ''}
      <details class="sent"><summary>What Google saw (exactly)</summary><pre>${esc(r.sentSummary)}</pre></details>
      <p class="opinion__foot"></p>
    </div>`;
  el.querySelector('.opinion__foot')!.append(routeBadge('in_cloud', `${JUDGE_LABEL} · ${fmtMs(r.latencyMs)}`));
  if (r.searchEntryPointHtml) {
    // Google Search suggestions must be shown as provided; a shadow root keeps their styles contained.
    el.querySelector('.search-entry')!.attachShadow({ mode: 'open' }).innerHTML = r.searchEntryPointHtml;
  }
}

/** Swap the freshly rendered placeholder for the kept element, if any. */
function adopt(root: HTMLElement, sel: string, kept: HTMLElement | null): HTMLElement {
  const fresh = root.querySelector<HTMLElement>(sel)!;
  if (!kept) return fresh;
  fresh.replaceWith(kept);
  return kept;
}

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

/** "Alex, Crypto Prime Markets" → "Alex"; "Dr Richard" stays "Dr Richard". */
export const firstName = (s: string) => s.split(',')[0]!.trim();
export const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const attr = (s: string) => (/^https?:\/\//.test(s) ? esc(s) : '#');
