import type { AI } from 'firebase/ai';
import { createTaggerModel, deviceAvailability, tagMessage } from './ai';
import type { ChatMessage } from './types';

/**
 * M0 spike panel: proves hybrid inference works in this context (web page or extension
 * side panel) and shows which route served each call. Plain DOM so both apps can mount it.
 */
const SAMPLES = [
  'Good morning my dear, I prayed for you today. God brought you into my life for a reason ❤️',
  'This WhatsApp line is not stable on the rig, add me on Telegram @eng_mark_offshore',
  "Please don't tell your children about us yet, they won't understand what we have",
  'My manager showed me Vexacoin Pro, guaranteed 30% weekly. Send 500 USDT to start, deadline is Friday',
  'Lunch at 1? I will bring the documents for the school fees',
];

export function mountSpike(root: HTMLElement, ai: AI, opts: { cloudModel?: string; title: string }) {
  root.innerHTML = `
    <h1>${opts.title}</h1>
    <p class="muted">M0 spike: hybrid inference check</p>
    <section>
      <div class="row"><b>Chrome Prompt API:</b> <code id="avail">checking…</code></div>
      <button id="init">1. Prepare on-device model</button>
      <progress id="prog" max="1" value="0" hidden></progress>
    </section>
    <section>
      <label><input type="checkbox" id="cloud"> Allow cloud fallback (consent)</label>
      <select id="sample">${SAMPLES.map((s, i) => `<option value="${i}">${s.slice(0, 60)}</option>`).join('')}</select>
      <textarea id="text" rows="3"></textarea>
      <button id="run">2. Tag message</button>
    </section>
    <pre id="out" aria-live="polite"></pre>`;

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const out = $('out');
  const text = $<HTMLTextAreaElement>('text');
  const sample = $<HTMLSelectElement>('sample');
  text.value = SAMPLES[0]!;
  sample.onchange = () => (text.value = SAMPLES[Number(sample.value)]!);

  const log = (o: unknown) => (out.textContent = typeof o === 'string' ? o : JSON.stringify(o, null, 2));
  const refreshAvail = async () => ($('avail').textContent = await deviceAvailability());
  void refreshAvail();

  const model = () =>
    createTaggerModel(ai, { allowCloudFallback: $<HTMLInputElement>('cloud').checked, cloudModel: opts.cloudModel });

  $('init').onclick = async () => {
    const prog = $<HTMLProgressElement>('prog');
    prog.hidden = false;
    try {
      // Must run inside a user gesture: may trigger the Nano download.
      await model().initializeDeviceModel((p) => (prog.value = p));
      log('On-device model ready.');
    } catch (e) {
      log(`initializeDeviceModel failed: ${(e as Error).message}`);
    }
    void refreshAvail();
  };

  $('run').onclick = async () => {
    log('Tagging…');
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      contactId: 'spike',
      fromUser: false,
      text: text.value,
      sentAt: Date.now(),
      source: 'demo',
    };
    try {
      const tagged = await tagMessage(model(), msg);
      log({ route: tagged.route, latencyMs: tagged.latencyMs, hits: tagged.hits });
    } catch (e) {
      log(`Error: ${(e as Error).message}\n\nIf this says the on-device model is unavailable, that is the privacy guard working: tick "Allow cloud fallback" to send it to the cloud instead.`);
    }
  };
}
