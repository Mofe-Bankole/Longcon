import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { CustomProvider, initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type AI,
  type GenerativeModel,
} from 'firebase/ai';
import { TAG_SCHEMA, TAGGER_SYSTEM, taggerPrompt } from './prompts';
import { isTacticId } from './tactics';
import type { ChatMessage, Route, TacticHit, TaggedMessage } from './types';

export interface LongconEnv {
  firebase: FirebaseOptions;
  /** reCAPTCHA v3 site key (web). Omit in the extension. */
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
    ? new ReCaptchaV3Provider(env.recaptchaSiteKey)
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
}

export function createTaggerModel(ai: AI, opts: TaggerOptions): GenerativeModel {
  return getGenerativeModel(ai, {
    mode: opts.allowCloudFallback ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
        initialPrompts: [{ role: 'system', content: [{ type: 'text', value: TAGGER_SYSTEM }] }],
      },
      promptOptions: { responseConstraint: TAG_SCHEMA },
    },
    inCloudParams: {
      model: opts.cloudModel ?? DEFAULT_CLOUD_MODEL,
      systemInstruction: TAGGER_SYSTEM,
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: TAG_SCHEMA as unknown as Record<string, unknown>,
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

/** Defensive parse: small models occasionally wrap JSON or invent tactic ids. */
export function parseHits(raw: string, messageText: string): TacticHit[] {
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  const hits = (parsed as { hits?: unknown }).hits;
  if (!Array.isArray(hits)) return [];
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
