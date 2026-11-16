import type { LongconEnv } from './ai';

/**
 * Reads Firebase config from Vite env vars (VITE_*), loaded from the repo-root .env.local.
 * The Firebase web config is not a secret (it ships in every web app); App Check +
 * API-key restrictions are what protect the backend. The debug token IS sensitive:
 * keep it in .env.local only, never commit it.
 */
export function envFromVite(e: Record<string, string | boolean | undefined>): LongconEnv {
  const need = (k: string) => {
    const v = e[k];
    if (typeof v !== 'string' || !v) throw new Error(`Missing ${k}: copy .env.example to .env.local and fill it in`);
    return v;
  };
  const debug = e.VITE_APPCHECK_DEBUG_TOKEN;
  return {
    firebase: {
      apiKey: need('VITE_FIREBASE_API_KEY'),
      authDomain: need('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: need('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: (e.VITE_FIREBASE_STORAGE_BUCKET as string) || undefined,
      messagingSenderId: (e.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || undefined,
      appId: need('VITE_FIREBASE_APP_ID'),
    },
    recaptchaSiteKey: (e.VITE_RECAPTCHA_SITE_KEY as string) || undefined,
    appCheckDebugToken: debug === 'true' ? true : (debug as string) || undefined,
    cloudModel: (e.VITE_CLOUD_MODEL as string) || undefined,
  };
}
