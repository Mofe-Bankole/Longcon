import '@longcon/ui';
import './app.css';
import { initModel } from './engine';
import { mountInbox } from './inbox';

const root = document.getElementById('app')!;

async function route(): Promise<void> {
  const page = location.hash.replace(/^#\/?/, '');
  if (page === 'bench') (await import('./bench')).mountBench(root);
  else if (page === 'spike') {
    const { envFromVite, initLongcon, mountSpike } = await import('@longcon/core');
    await import('@longcon/core/src/spike.css');
    const env = envFromVite(import.meta.env);
    mountSpike(root, initLongcon(env), { cloudModel: env.cloudModel, title: 'Longcon · spike' });
  } else mountInbox(root);
}

window.addEventListener('hashchange', () => location.reload());
void route();
void initModel();
