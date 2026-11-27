import { STAGE_LABELS, STAGES, type ContactRisk, type Route, type Stage } from '@longcon/core';
import './arc.css';

export type SegmentState = 'empty' | 'provisional' | 'confirmed';

export interface ArcSegment {
  stage: Stage;
  label: string;
  state: SegmentState;
  /** Day (since first message) this stage first appeared, if it has. */
  day: number | null;
}

/** Pure: what the Arc shows for a contact. Shared logic for every surface (and mirrored on Android). */
export function arcSegments(risk: Pick<ContactRisk, 'timeline'>): ArcSegment[] {
  return STAGES.map((stage) => {
    const events = risk.timeline.filter((e) => e.stage === stage);
    const confirmed = events.some((e) => e.route !== 'rules');
    return {
      stage,
      label: STAGE_LABELS[stage],
      state: events.length === 0 ? 'empty' : confirmed ? 'confirmed' : 'provisional',
      day: events.length ? Math.min(...events.map((e) => e.day)) : null,
    };
  });
}

const STAGE_VAR: Record<Stage, string> = {
  rapport: 'var(--stage-rapport)',
  isolation: 'var(--stage-isolation)',
  hook: 'var(--stage-hook)',
  extraction: 'var(--stage-extraction)',
};

/** Render (or update in place) the Arc. Updating keeps CSS transitions smooth. */
export function renderArc(risk: Pick<ContactRisk, 'timeline'>, el?: HTMLElement, opts: { compact?: boolean } = {}): HTMLElement {
  const root = el ?? document.createElement('div');
  root.className = `lc-arc${opts.compact ? ' lc-arc--compact' : ''}`;
  root.setAttribute('role', 'img');
  const segs = arcSegments(risk);
  if (root.children.length !== 4) {
    root.replaceChildren(
      ...segs.map((s) => {
        const seg = document.createElement('div');
        seg.className = 'lc-arc__seg';
        seg.style.setProperty('--seg', STAGE_VAR[s.stage]);
        seg.innerHTML = '<div class="lc-arc__bar"></div><div class="lc-arc__label"></div><div class="lc-arc__day"></div>';
        return seg;
      }),
    );
  }
  segs.forEach((s, i) => {
    const seg = root.children[i] as HTMLElement;
    seg.dataset.state = s.state;
    seg.querySelector('.lc-arc__label')!.textContent = s.label;
    seg.querySelector('.lc-arc__day')!.textContent = s.day === null ? '' : `Day ${s.day + 1}`;
  });
  const reached = segs.filter((s) => s.state !== 'empty').map((s) => `${s.label} (day ${s.day! + 1})`);
  root.setAttribute('aria-label', reached.length ? `Warning signs so far: ${reached.join(', ')}` : 'No warning signs so far');
  return root;
}

const ICONS: Record<Route, string> = {
  on_device: '<path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  in_cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  rules: '<path d="M13 3 5 14h6l-1 7 8-11h-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
};

/**
 * Plain-words route labels (docs/design.md "Plain words"). Must stay literally true:
 * a tagged message with route in_cloud means its text WAS sent (only ever with consent).
 * The cloud judge card uses JUDGE_LABEL instead, because it only receives a redacted summary.
 */
export const ROUTE_LABELS: Record<Route, string> = {
  on_device: 'Checked privately on this device',
  in_cloud: 'Checked by Google, with your permission',
  rules: 'Quick check',
};
export const JUDGE_LABEL = 'Second opinion from Google (only the warning signs were sent, not the conversation)';

export function routeBadge(route: Route, text = ROUTE_LABELS[route]): HTMLElement {
  const el = document.createElement('span');
  el.className = 'lc-route';
  el.dataset.route = route;
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[route]}</svg>`;
  el.append(text);
  return el;
}
