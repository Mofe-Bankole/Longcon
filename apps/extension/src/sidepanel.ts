import { envFromVite, initLongcon, mountSpike } from '@longcon/core';
import '@longcon/core/src/spike.css';

// The side panel is an extension *page* (has window + DOM), so Chrome's Prompt API
// (LanguageModel) is available here; the service worker is not used for inference.
const env = envFromVite(import.meta.env);
const ai = initLongcon(env);
mountSpike(document.getElementById('app')!, ai, { cloudModel: env.cloudModel, title: 'Longcon · extension' });
