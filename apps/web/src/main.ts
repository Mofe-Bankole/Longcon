import { envFromVite, initLongcon, mountSpike } from '@longcon/core';
import '@longcon/core/src/spike.css';

const env = envFromVite(import.meta.env);
const ai = initLongcon(env);
mountSpike(document.getElementById('app')!, ai, { cloudModel: env.cloudModel, title: 'Longcon · web' });
