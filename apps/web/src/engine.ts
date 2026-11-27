import {
  createJudgeModel,
  createTaggerModel,
  deviceAvailability,
  envFromVite,
  initLongcon,
  judge,
  modelTagger,
  Router,
  warmUp,
  type ContactRisk,
  type DeviceAvailability,
  type GenerativeModel,
  type JudgeResult,
} from '@longcon/core';

/**
 * Page-wide Longcon engine: availability, consent, the router, and the cloud judge.
 * The UI subscribes to `onChange` and re-renders from this state.
 */
export type ModelStatus = 'checking' | 'ready' | 'downloadable' | 'downloading' | 'unavailable';

const env = envFromVite(import.meta.env);
const ai = initLongcon(env);

type Listener = (what: 'model' | 'contact' | 'queue' | 'judge', contactId?: string) => void;
const listeners = new Set<Listener>();
const emit: Listener = (w, id) => listeners.forEach((l) => l(w, id));

export const state = {
  status: 'checking' as ModelStatus,
  availability: 'no-api' as DeviceAvailability,
  downloadProgress: 0,
  /** The person allowed Google to label these (made-up) demo messages. */
  cloudConsent: false,
  modelError: '' as string,
  judge: new Map<string, { phase: 'running' | 'done' | 'error'; result?: JudgeResult; error?: string }>(),
};

export const router = new Router({
  batchSize: 6,
  events: {
    onContact: (r) => emit('contact', r.contactId),
    onQueue: () => emit('queue'),
    onModelError: (err) => {
      state.modelError = friendlyError(err);
      emit('model');
    },
  },
});

export function onChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

let tagModel: GenerativeModel | undefined;

function applyTagger(): void {
  const onDevice = state.status === 'ready';
  if (!onDevice && !state.cloudConsent) return; // rules only
  // ONLY_ON_DEVICE unless the person ticked consent: the privacy guard.
  tagModel = createTaggerModel(ai, { allowCloudFallback: state.cloudConsent, batch: true, cloudModel: env.cloudModel });
  state.modelError = '';
  router.resume(modelTagger(tagModel, { batch: true }));
}

export async function initModel(): Promise<void> {
  state.availability = await deviceAvailability();
  state.status =
    state.availability === 'available'
      ? 'ready'
      : state.availability === 'downloadable' || state.availability === 'downloading'
        ? 'downloadable'
        : 'unavailable';
  emit('model');
  applyTagger();
  if (tagModel && state.status === 'ready') void warmUp(tagModel);
}

/** Must run from a click (Chrome requires a user gesture to start the download). */
export async function downloadModel(): Promise<void> {
  state.status = 'downloading';
  emit('model');
  try {
    const m = createTaggerModel(ai, { allowCloudFallback: false, batch: true });
    await m.initializeDeviceModel((p) => {
      state.downloadProgress = p;
      emit('model');
    });
    await initModel();
  } catch (err) {
    state.modelError = friendlyError(err);
    state.status = 'unavailable';
    emit('model');
  }
}

export function setCloudConsent(on: boolean): void {
  state.cloudConsent = on;
  emit('model');
  if (on || state.status === 'ready') applyTagger();
}

let judgeModel: GenerativeModel | undefined;
let judgePlain: GenerativeModel | undefined;

export async function runJudge(risk: ContactRisk, names: string[], channel: string): Promise<void> {
  judgeModel ??= createJudgeModel(ai, env.cloudModel);
  judgePlain ??= createJudgeModel(ai, env.cloudModel, { grounded: false });
  state.judge.set(risk.contactId, { phase: 'running' });
  emit('judge', risk.contactId);
  try {
    const result = await judge(judgeModel, risk, { names, channel, fallback: judgePlain });
    state.judge.set(risk.contactId, { phase: 'done', result });
  } catch (err) {
    const msg = friendlyError(err);
    state.judge.set(risk.contactId, {
      phase: 'error',
      error: /busy/.test(msg) ? 'Google has reached its limit for second opinions right now. Please try again in a minute.' : msg,
    });
  }
  emit('judge', risk.contactId);
}

export function resetJudge(contactId: string): void {
  state.judge.delete(contactId);
}

/** Plain-language errors (no SDK codes in the protected-person UI; the code goes to the console). */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn('[longcon]', err);
  if (/api-not-enabled|not available in this environment|unsupported/i.test(msg))
    return "This computer can't run the private model.";
  if (/app check|401|403/i.test(msg)) return 'Longcon could not verify this page with Firebase (App Check).';
  if (/quota|429|busy/i.test(msg)) return 'The model is busy. Longcon will keep trying.';
  if (/network|fetch|offline/i.test(msg)) return "Can't reach the internet right now.";
  return 'Something went wrong while checking.';
}
