import { LEVEL_TITLES, TACTICS, type ChatMessage } from '@longcon/core';
import { renderArc, routeBadge } from '@longcon/ui';
import { CHANNEL_NAMES, CONVERSATIONS, type DemoConversation } from './corpus';
import { downloadModel, onChange, resetJudge, router, setCloudConsent, state } from './engine';
import { esc, renderPanel } from './panel';

/**
 * The demo inbox: six made-up conversations (three scams, three genuine) that replay over their
 * real timespan, so you can watch Longcon read the long game as it happens.
 */
const DAY = 86_400_000;
const SPEEDS = { normal: 650, fast: 120 };

interface ConvState {
  fed: number;
  timer?: number;
}
const convState = new Map<string, ConvState>(CONVERSATIONS.map((c) => [c.id, { fed: 0 }]));
let current = CONVERSATIONS[0]!;
let speed: keyof typeof SPEEDS = 'normal';

export function mountInbox(root: HTMLElement): void {
  // Deep links: ?c=<conversation id> opens it, &all=1 shows every message at once.
  const params = new URLSearchParams(location.search);
  current = CONVERSATIONS.find((c) => c.id === params.get('c')) ?? current;
  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#/"><span class="brand__mark" aria-hidden="true"></span>Longcon</a>
      <span class="topbar__tag">Demo · 6 made-up conversations</span>
      <a class="topbar__link" href="#/about">How it works</a>
      <div class="model" id="model"></div>
    </header>
    <div class="inbox">
      <nav class="convs" id="convs" aria-label="Conversations"></nav>
      <section class="thread" aria-label="Messages">
        <div class="thread__bar" id="bar"></div>
        <div class="thread__scroll" id="scroll"><ol class="msgs" id="msgs"></ol></div>
      </section>
      <aside id="panel" aria-live="polite"></aside>
    </div>`;

  renderConvs();
  renderThread(true);
  renderModel();
  if (params.get('all') === '1') feed(current.messages.length);

  onChange((what, id) => {
    if (what === 'model') renderModel();
    if (what === 'contact' || what === 'queue') renderConvs();
    if ((what === 'contact' || what === 'judge' || what === 'queue') && (!id || id === current.id)) {
      renderPanel(document.getElementById('panel')!, current, convState.get(current.id)!.fed);
      decorateMessages();
    }
  });
}

function renderModel(): void {
  const el = document.getElementById('model')!;
  const s = state.status;
  const label =
    s === 'ready'
      ? 'Private model ready on this computer'
      : s === 'downloading'
        ? `Downloading the private model… ${Math.round(state.downloadProgress * 100)}%`
        : s === 'downloadable'
          ? 'Private model not downloaded yet'
          : s === 'checking'
            ? 'Checking this computer…'
            : "This computer can't run the private model";
  el.innerHTML = `<span class="model__dot model__dot--${s}"></span><span>${label}</span>`;
  if (s === 'downloadable') {
    const b = button('Download (one time)', 'btn btn--small', () => downloadModel());
    el.append(b);
  }
  if (s === 'unavailable' || s === 'downloadable') {
    const wrap = document.createElement('label');
    wrap.className = 'consent';
    wrap.innerHTML = `<input type="checkbox" ${state.cloudConsent ? 'checked' : ''}/> Let Google check these demo messages <span class="muted">(they're made up)</span>`;
    wrap.querySelector('input')!.onchange = (e) => setCloudConsent((e.target as HTMLInputElement).checked);
    el.append(wrap);
  }
  if (state.modelError) {
    const err = document.createElement('span');
    err.className = 'model__err';
    err.textContent = state.modelError + (state.cloudConsent ? '' : ' Quick checks still work.');
    el.append(err);
  }
}

function renderConvs(): void {
  const nav = document.getElementById('convs')!;
  nav.replaceChildren(
    ...CONVERSATIONS.map((c) => {
      const risk = router.contact(c.id);
      const b = document.createElement('button');
      b.className = `conv${c.id === current.id ? ' conv--active' : ''}`;
      b.innerHTML = `
        <span class="avatar">${esc(c.initial)}</span>
        <span class="conv__main">
          <span class="conv__who"><b>${esc(c.userName)}</b> &amp; ${esc(c.contactName)}</span>
          <span class="conv__meta">${c.channels.map((x) => CHANNEL_NAMES[x]).join(' → ')} · ${c.spanDays} days</span>
          <span class="conv__arc"></span>
        </span>
        ${risk ? `<span class="chip level-${risk.level}">${LEVEL_TITLES[risk.level]}</span>` : ''}`;
      renderArc(risk ?? { timeline: [] }, b.querySelector<HTMLElement>('.conv__arc')!, { compact: true });
      b.onclick = () => select(c);
      return b;
    }),
  );
}

function select(c: DemoConversation): void {
  if (c.id === current.id) return;
  current = c;
  renderConvs();
  renderThread(true);
}

function renderThread(full: boolean): void {
  const cs = convState.get(current.id)!;
  const bar = document.getElementById('bar')!;
  const playing = cs.timer !== undefined;
  const done = cs.fed >= current.messages.length;
  bar.innerHTML = `
    <div class="bar__title"><b>${esc(current.userName)}</b> &amp; ${esc(current.contactName)}
      <span class="muted">${cs.fed}/${current.messages.length} messages${cs.fed ? ` · day ${dayOf(current.messages[cs.fed - 1]!) + 1} of ${current.spanDays}` : ''}</span></div>
    <div class="bar__controls"></div>`;
  const controls = bar.querySelector('.bar__controls')!;
  if (!done) controls.append(button(playing ? '❚❚ Pause' : cs.fed ? '▶ Resume' : '▶ Play', 'btn btn--primary', () => (playing ? pause() : play())));
  controls.append(
    button(speed === 'fast' ? 'Speed: fast' : 'Speed: normal', 'btn btn--ghost', () => {
      speed = speed === 'fast' ? 'normal' : 'fast';
      if (cs.timer !== undefined) {
        pause();
        play();
      } else renderThread(false);
    }),
  );
  if (!done) controls.append(button('Show all', 'btn btn--ghost', () => feed(current.messages.length - cs.fed)));
  if (cs.fed) controls.append(button('Reset', 'btn btn--ghost', reset));

  if (full) {
    const list = document.getElementById('msgs')!;
    list.replaceChildren(...current.messages.slice(0, cs.fed).flatMap((m, i) => messageNodes(m, current.messages[i - 1])));
    if (!cs.fed) {
      const intro = document.createElement('li');
      intro.className = 'intro';
      intro.innerHTML = `<p class="intro__big">${current.spanDays} days of messages, replayed.</p>
        <p>One message rarely looks dangerous. The pattern across weeks does.
        Press <b>Play</b> and watch Longcon read the long game.</p>`;
      list.append(intro);
    }
  }
  renderPanel(document.getElementById('panel')!, current, cs.fed);
  decorateMessages();
}

function messageNodes(m: ChatMessage, prev?: ChatMessage): HTMLElement[] {
  const out: HTMLElement[] = [];
  const d = dayOf(m);
  if (!prev || dayOf(prev) !== d) {
    const sep = document.createElement('li');
    sep.className = 'day';
    sep.textContent = `Day ${d + 1} · ${new Date(m.sentAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`;
    out.push(sep);
  }
  if (prev && prev.source !== m.source) {
    const sw = document.createElement('li');
    sw.className = 'switch';
    sw.textContent = `Moved from ${CHANNEL_NAMES[prev.source]} to ${CHANNEL_NAMES[m.source]}`;
    out.push(sw);
  }
  const li = document.createElement('li');
  li.className = `msg ${m.fromUser ? 'msg--out' : 'msg--in'}`;
  li.dataset.id = m.id;
  li.innerHTML = `<div class="msg__bubble">${esc(m.text)}</div><div class="msg__meta">${new Date(m.sentAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · ${CHANNEL_NAMES[m.source]}</div><div class="msg__signs"></div>`;
  out.push(li);
  return out;
}

/** Under each message: the signs found and how (quick check → checked privately). */
function decorateMessages(): void {
  const tags = router.tagsFor(current.id);
  for (const li of document.querySelectorAll<HTMLElement>('#msgs .msg--in')) {
    const t = tags.get(li.dataset.id!);
    const box = li.querySelector('.msg__signs')!;
    const key = t ? `${t.route}:${t.hits.map((h) => h.tactic).join()}` : 'none';
    if (box.getAttribute('data-key') === key) continue;
    box.setAttribute('data-key', key);
    box.replaceChildren();
    if (!t || !t.hits.length) continue;
    for (const h of t.hits) {
      const chip = document.createElement('span');
      chip.className = `sign-chip stage-${TACTICS[h.tactic].stage}${t.route === 'rules' ? ' sign-chip--provisional' : ''}`;
      chip.textContent = TACTICS[h.tactic].plain;
      box.append(chip);
    }
    box.append(routeBadge(t.route));
  }
}

function feed(n: number): void {
  const cs = convState.get(current.id)!;
  const next = current.messages.slice(cs.fed, cs.fed + n);
  if (!next.length) return;
  const list = document.getElementById('msgs')!;
  list.querySelector('.intro')?.remove();
  next.forEach((m, i) => list.append(...messageNodes(m, current.messages[cs.fed + i - 1])));
  cs.fed += next.length;
  void router.ingest(next);
  if (cs.fed >= current.messages.length) pause();
  renderThread(false);
  const scroll = document.getElementById('scroll')!;
  scroll.scrollTo({ top: scroll.scrollHeight, behavior: n > 3 ? 'auto' : 'smooth' });
}

function play(): void {
  const cs = convState.get(current.id)!;
  const id = current.id;
  cs.timer = window.setInterval(() => (current.id === id ? feed(1) : undefined), SPEEDS[speed]);
  renderThread(false);
}

function pause(): void {
  const cs = convState.get(current.id)!;
  if (cs.timer !== undefined) clearInterval(cs.timer);
  cs.timer = undefined;
}

function reset(): void {
  pause();
  convState.set(current.id, { fed: 0 });
  router.forget(current.id);
  resetJudge(current.id);
  renderConvs();
  renderThread(true);
}

const dayOf = (m: ChatMessage) => {
  const first = CONVERSATIONS.find((c) => c.id === m.contactId)!.messages[0]!.sentAt;
  return Math.floor((m.sentAt - first) / DAY);
};

function button(text: string, cls: string, onclick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = text;
  b.onclick = onclick;
  return b;
}
