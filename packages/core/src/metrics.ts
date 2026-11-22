import type { Route } from './types';

/** Rolling latency stats per route, shown in the UI ("checked privately in 420 ms") and the benchmark. */
export class LatencyStats {
  private samples: Record<Route, number[]> = { rules: [], on_device: [], in_cloud: [] };

  constructor(private readonly keep = 500) {}

  add(route: Route, ms: number): void {
    const a = this.samples[route];
    a.push(ms);
    if (a.length > this.keep) a.shift();
  }

  summary(route: Route): { n: number; p50: number; p95: number } {
    const a = [...this.samples[route]].sort((x, y) => x - y);
    const q = (p: number) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))]! : 0);
    return { n: a.length, p50: q(0.5), p95: q(0.95) };
  }
}
