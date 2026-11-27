import { getGenerativeModel, type AI, type GenerativeModel } from 'firebase/ai';
import { DEFAULT_CLOUD_MODEL } from './ai';
import { redact } from './redact';
import { STAGE_LABELS, TACTICS } from './tactics';
import type { ContactRisk } from './types';

/**
 * Rung 4: the cloud judge, a "second opinion" for escalated contacts only.
 *
 * It never sees the conversation. It gets a redacted PATTERN SUMMARY: which warning signs appeared
 * on which day, plus short redacted quotes of the claims worth checking (company names, platforms,
 * domains). Gemini then uses Google Search grounding to check those claims. The UI shows the exact
 * summary that was sent ("What Google saw").
 */
export interface JudgeCheck {
  claim: string;
  finding: string;
}

export interface JudgeResult {
  verdict: 'likely_scam' | 'unclear' | 'likely_safe';
  /** Two plain sentences for the protected person. */
  summary: string;
  checks: JudgeCheck[];
  /** Questions a real person could answer easily and a scammer can't. */
  questions: string[];
  sources: { title: string; uri: string }[];
  /** Google Search suggestions chip HTML; must be shown when present (grounding terms). */
  searchEntryPointHtml?: string;
  /** Exactly what left the device. */
  sentSummary: string;
  latencyMs: number;
}

const JUDGE_SYSTEM = `You are a fraud analyst giving a second opinion to an older adult and their family.
You receive a redacted summary of warning signs seen in a conversation, never the conversation itself.
Use Google Search to check concrete claims (companies, trading platforms, job offers, websites, regulators).
Reply with ONLY a JSON object:
{"verdict":"likely_scam"|"unclear"|"likely_safe",
 "summary":"two short sentences in plain words a 75-year-old understands; no jargon; never blame the reader",
 "checks":[{"claim":"what was claimed","finding":"what search showed, plainly"}],
 "questions":["three questions to ask the contact that a genuine person could answer easily but a scammer cannot, e.g. a live video call today"]}
At most 3 checks. Exactly 3 questions. Placeholders like [EMAIL_1] are redactions; do not guess them.`;

export function createJudgeModel(ai: AI, cloudModel = DEFAULT_CLOUD_MODEL): GenerativeModel {
  return getGenerativeModel(ai, {
    model: cloudModel,
    systemInstruction: JUDGE_SYSTEM,
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.2 },
  });
}

/** Build the redacted pattern summary. `names` are redacted (the user's and the contact's names). */
export function judgeSummary(risk: ContactRisk, opts: { names?: string[]; channel?: string } = {}): string {
  const days = Math.max(...risk.timeline.map((e) => e.day), 0) + 1;
  const lines = [
    `Conversation over ${days} day(s)${opts.channel ? ` on ${opts.channel}` : ''}. Furthest stage: ${
      risk.stageReached ? STAGE_LABELS[risk.stageReached] : 'none'
    }.`,
    'Warning signs, in order:',
  ];
  const seen = new Set<string>();
  for (const e of risk.timeline) {
    const key = `${e.tactic}:${e.day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const quote = redact(e.evidence, opts.names ?? []).text.slice(0, 100);
    lines.push(`- Day ${e.day + 1}: ${TACTICS[e.tactic].label} (${e.stage}). Claim: "${quote}"`);
  }
  return lines.join('\n');
}

export async function judge(
  model: GenerativeModel,
  risk: ContactRisk,
  opts: { names?: string[]; channel?: string } = {},
): Promise<JudgeResult> {
  const sentSummary = judgeSummary(risk, opts);
  const t0 = performance.now();
  const result = await model.generateContent(sentSummary);
  const latencyMs = Math.round(performance.now() - t0);
  const text = result.response.text();
  const meta = result.response.candidates?.[0]?.groundingMetadata;
  const sources = (meta?.groundingChunks ?? [])
    .flatMap((c) => (c.web?.uri ? [{ title: c.web.title ?? c.web.uri, uri: c.web.uri }] : []))
    .slice(0, 5);
  return { ...parseJudge(text), sources, searchEntryPointHtml: meta?.searchEntryPoint?.renderedContent, sentSummary, latencyMs };
}

export function parseJudge(raw: string): Pick<JudgeResult, 'verdict' | 'summary' | 'checks' | 'questions'> {
  let o: Record<string, unknown> = {};
  try {
    o = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch {
    /* fall through to defaults */
  }
  const verdict = ['likely_scam', 'unclear', 'likely_safe'].includes(o.verdict as string)
    ? (o.verdict as JudgeResult['verdict'])
    : 'unclear';
  const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  return {
    verdict,
    summary: str(o.summary) || 'We could not get a clear second opinion. Please talk to someone you trust before sending anything.',
    checks: (Array.isArray(o.checks) ? o.checks : [])
      .map((c) => ({ claim: str((c as JudgeCheck).claim), finding: str((c as JudgeCheck).finding) }))
      .filter((c) => c.claim && c.finding)
      .slice(0, 3),
    questions: (Array.isArray(o.questions) ? o.questions : []).map(str).filter(Boolean).slice(0, 3),
  };
}
