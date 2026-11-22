import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type AI,
  type GenerativeModel,
} from 'firebase/ai';
import { BATCH_TAG_SCHEMA, BATCH_TAGGER_SYSTEM, batchTaggerPrompt, TAG_SCHEMA, TAGGER_SYSTEM, taggerPrompt } from './prompts';
import { isTacticId } from './tactics';
import type { ChatMessage, Route, TacticHit, TaggedMessage } from './types';

export interface LongconEnv {
  firebase: FirebaseOptions;
  /** reCAPTCHA Enterprise site key (web). Omit in the extension. */
  recaptchaSiteKey?: string;
  /** App Check debug token: `true` to generate one (dev), or a registered token string. */
  appCheckDebugToken?: string | boolean;
  /** Cloud model override; defaults to the SDK's hybrid default. */
  cloudModel?: string;
}

/** Matches the SDK's DEFAULT_HYBRID_IN_CLOUD_MODEL (firebase 13.x). */
export const DEFAULT_CLOUD_MODEL = 'gemini-3.5-flash-lite';

let ai: AI | undefined;
let app: FirebaseApp | undefined;

export function initLongcon(env: LongconEnv): AI {
  if (ai) return ai;
  if (env.appCheckDebugToken) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      env.appCheckDebugToken;
  }
  app = initializeApp(env.firebase);
  // In debug mode the SDK exchanges the debug token and never calls the provider.
  // Extensions can't load reCAPTCHA (MV3 forbids remote code), so they rely on debug mode.
  const provider = env.recaptchaSiteKey
    ? new ReCaptchaEnterpriseProvider(env.recaptchaSiteKey)
    : new CustomProvider({
        getToken: () => Promise.reject(new Error('No App Check provider: set a debug token or a reCAPTCHA site key')),
      });
  initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  ai = getAI(app, { backend: new GoogleAIBackend() });
  return ai;
}

export interface TaggerOptions {
  /**
   * Privacy promise: by default every message is labelled ON DEVICE ONLY.
   * If Nano is unavailable the tagger fails instead of silently uploading chats.
   * The user must explicitly opt in to cloud labelling.
   */
  allowCloudFallback: boolean;
  cloudModel?: string;
  /** Tag several messages per call (web default). Android uses single-message calls (4k-token limit). */
  batch?: boolean;
}

export function createTaggerModel(ai: AI, opts: TaggerOptions): GenerativeModel {
  const system = opts.batch ? BATCH_TAGGER_SYSTEM : TAGGER_SYSTEM;
  const schema = opts.batch ? BATCH_TAG_SCHEMA : TAG_SCHEMA;
  return getGenerativeModel(ai, {
    mode: opts.allowCloudFallback ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
        initialPrompts: [{ role: 'system', content: [{ type: 'text', value: system }] }],
      },
      promptOptions: { responseConstraint: schema },
    },
    inCloudParams: {
      model: opts.cloudModel ?? DEFAULT_CLOUD_MODEL,
      systemInstruction: system,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: schema as unknown as Record<string, unknown>,
      },
    },
  });
}

/** Label one message. `context` is a few earlier messages, oldest first. */
export async function tagMessage(
  model: GenerativeModel,
  msg: ChatMessage,
  context: string[] = [],
): Promise<TaggedMessage> {
  const t0 = performance.now();
  const result = await model.generateContent(taggerPrompt(msg.text, context.slice(-3)));
  const latencyMs = Math.round(performance.now() - t0);
  const route: Route = (result.response.inferenceSource as Route | undefined) ?? 'in_cloud';
  return {
    messageId: msg.id,
    contactId: msg.contactId,
    sentAt: msg.sentAt,
    hits: parseHits(result.response.text(), msg.text),
    route,
    latencyMs,
  };
}

/**
 * Label a batch of messages from one contact in a single model call.
 * Returns one TaggedMessage per input, in order. Latency is the call's total divided across the batch.
 */
export async function tagBatch(
  model: GenerativeModel,
  msgs: ChatMessage[],
  context: string[] = [],
): Promise<TaggedMessage[]> {
  if (msgs.length === 0) return [];
  const t0 = performance.now();
  const result = await model.generateContent(batchTaggerPrompt(msgs.map((m) => m.text), context.slice(-3)));
  const latencyMs = Math.round(performance.now() - t0);
  const route: Route = (result.response.inferenceSource as Route | undefined) ?? 'in_cloud';
  const byN = parseBatch(result.response.text());
  return msgs.map((m, i) => ({
    messageId: m.id,
    contactId: m.contactId,
    sentAt: m.sentAt,
    hits: normaliseHits(byN.get(i + 1) ?? [], m.text),
    route,
    latencyMs: Math.round(latencyMs / msgs.length),
  }));
}

/** Warm-up: loads Nano into memory so the first real check is fast. Call when the panel opens. */
export async function warmUp(model: GenerativeModel): Promise<number> {
  const t0 = performance.now();
  await model.generateContent('Messages to label:\n[1] hello\n\nReturn JSON.').catch(() => undefined);
  return Math.round(performance.now() - t0);
}

function parseBatch(raw: string): Map<number, unknown[]> {
  const out = new Map<number, unknown[]>();
  const parsed = parseJsonObject(raw) as { results?: unknown } | undefined;
  if (!Array.isArray(parsed?.results)) return out;
  for (const r of parsed.results) {
    const n = Number((r as { n?: unknown }).n);
    const hits = (r as { hits?: unknown }).hits;
    if (Number.isInteger(n) && Array.isArray(hits) && !out.has(n)) out.set(n, hits);
  }
  return out;
}

function parseJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch {
    return undefined;
  }
}

/** Defensive parse: small models occasionally wrap JSON or invent tactic ids. */
export function parseHits(raw: string, messageText: string): TacticHit[] {
  const hits = (parseJsonObject(raw) as { hits?: unknown } | undefined)?.hits;
  return Array.isArray(hits) ? normaliseHits(hits, messageText) : [];
}

function normaliseHits(hits: unknown[], messageText: string): TacticHit[] {
  const seen = new Set<string>();
  const out: TacticHit[] = [];
  for (const h of hits) {
    const tactic = (h as { tactic?: unknown }).tactic;
    const evidence = String((h as { evidence?: unknown }).evidence ?? '').slice(0, 120);
    if (!isTacticId(tactic) || seen.has(tactic)) continue;
    seen.add(tactic);
    out.push({ tactic, evidence: evidence || messageText.slice(0, 120) });
  }
  return out;
}

export type DeviceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'no-api';

/** Diagnostic: what Chrome's Prompt API reports, independent of Firebase. */
export async function deviceAvailability(): Promise<DeviceAvailability> {
  const LM = (globalThis as unknown as { LanguageModel?: { availability: (o?: object) => Promise<string> } })
    .LanguageModel;
  if (!LM) return 'no-api';
  try {
    return (await LM.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    })) as DeviceAvailability;
  } catch {
    return 'unavailable';
  }
}
