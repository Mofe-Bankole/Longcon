// Cloud smoke test: node scripts/smoke-cloud.mjs
// Calls the cloud tagger through Firebase AI Logic using .env.local. Works only while App Check
// is NOT enforced for AI Logic (Node can't produce App Check tokens). Use it to check project setup.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID,
});
const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
  model: env.VITE_CLOUD_MODEL || 'gemini-3.5-flash-lite',
  generationConfig: { temperature: 0, responseMimeType: 'application/json' },
});
const t0 = Date.now();
const r = await model.generateContent(
  'Label scam tactics in this message as JSON {"hits":[{"tactic","evidence"}]}: ' +
  '"Please don\'t tell your children about us. Send 500 USDT by Friday so we can start."',
);
console.log(`OK in ${Date.now() - t0} ms →`, r.response.text());
