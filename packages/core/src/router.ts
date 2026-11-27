import { tagBatch, tagMessage } from './ai';
import { LatencyStats } from './metrics';
import { DEFAULT_RISK_CONFIG, scoreContact, type RiskConfig } from './risk';
import { rulesTag } from './rules';
import type { ChatMessage, ContactRisk, TaggedMessage } from './types';
import type { GenerativeModel } from 'firebase/ai';

/**
 * The router runs the privacy ladder for one device (architecture §2.2):
 *
 *   1. rules      every message, instantly; the UI updates within a frame
 *   2. model      on-device Nano (or the cloud, only with consent), in batches, in the background;
 *                 its result REPLACES the provisional rules result for that message
 *   3. risk       deterministic re-score after every change
 *   4. escalate   onEscalate fires once when a contact crosses the threshold (cloud judge is the caller's job)
 *
 * Latency design: the person never waits on a model. They see the rules verdict at once, and the
 * model refines it. Model calls run one at a time (Nano is a single local process), riskiest contact
 * first, several messages per call, and results are cached so a message is never labelled twice.
 */
export interface Tagger {
  tag(msgs: ChatMessage[], context: string[]): Promise<TaggedMessage[]>;
}

export interface TagCache {
  get(messageId: string): Promise<TaggedMessage | undefined>;
  set(tagged: TaggedMessage): Promise<void>;
}

export interface RouterEvents {
  /** Fired whenever a contact's risk changes. */
  onContact?(risk: ContactRisk): void;
  /** Fired once per contact, the first time it should be escalated to the cloud judge. */
  onEscalate?(risk: ContactRisk): void;
  /** The model failed; rules results stay. Call `resume()` to try the model again. */
  onModelError?(err: unknown): void;
  /** Queue length changed (for "checking 3 of 12…" progress). */
  onQueue?(pending: number): void;
}

export interface RouterOptions {
  tagger?: Tagger;
  cache?: TagCache;
  cfg?: RiskConfig;
  /** Messages per model call. */
  batchSize?: number;
  events?: RouterEvents;
}

export function modelTagger(model: GenerativeModel, opts: { batch: boolean }): Tagger {
  return {
    tag: async (msgs, context) =>
      opts.batch
        ? tagBatch(model, msgs, context)
        : Promise.all(msgs.map((m, i) => tagMessage(model, m, [...context, ...msgs.slice(0, i).map((x) => x.text)]))),
  };
}

export function memoryCache(): TagCache {
  const m = new Map<string, TaggedMessage>();
  return { get: async (id) => m.get(id), set: async (t) => void m.set(t.messageId, t) };
}

interface ContactState {
  messages: Map<string, ChatMessage>;
  tags: Map<string, TaggedMessage>;
  risk?: ContactRisk;
  escalated: boolean;
}

export class Router {
  readonly latency = new LatencyStats();
  private contactsById = new Map<string, ContactState>();
  private queue: ChatMessage[] = [];
  private running = false;
  private modelDown = false;
  private readonly cfg: RiskConfig;
  private readonly batchSize: number;
  private readonly cache: TagCache;

  constructor(private readonly opts: RouterOptions = {}) {
    this.cfg = opts.cfg ?? DEFAULT_RISK_CONFIG;
    this.batchSize = opts.batchSize ?? 6;
    this.cache = opts.cache ?? memoryCache();
  }

  /** Add messages (any contacts, any order, duplicates ignored). Resolves after the rules pass. */
  async ingest(msgs: ChatMessage[]): Promise<void> {
    const touched = new Set<string>();
    for (const m of msgs) {
      const c = this.state(m.contactId);
      if (c.messages.has(m.id)) continue;
      c.messages.set(m.id, m);
      if (m.fromUser) continue;
      touched.add(m.contactId);

      const cached = await this.cache.get(m.id);
      if (cached && cached.route !== 'rules') {
        c.tags.set(m.id, cached);
        continue;
      }
      const t0 = performance.now();
      const hits = rulesTag(m.text);
      const ms = performance.now() - t0;
      this.latency.add('rules', ms);
      c.tags.set(m.id, { messageId: m.id, contactId: m.contactId, sentAt: m.sentAt, hits, route: 'rules', latencyMs: ms });
      if (this.opts.tagger) this.queue.push(m);
    }
    for (const id of touched) this.rescore(id);
    this.opts.events?.onQueue?.(this.queue.length);
    void this.drain();
  }

  contacts(): ContactRisk[] {
    return [...this.contactsById.values()].flatMap((c) => (c.risk ? [c.risk] : [])).sort((a, b) => b.score - a.score);
  }

  contact(id: string): ContactRisk | undefined {
    return this.contactsById.get(id)?.risk;
  }

  /** Labels for each message of a contact (to show signs under each message). */
  tagsFor(contactId: string): ReadonlyMap<string, TaggedMessage> {
    return this.contactsById.get(contactId)?.tags ?? new Map();
  }

  /** Drop everything known about a contact (demo reset). Cached labels stay cached. */
  forget(contactId: string): void {
    this.contactsById.delete(contactId);
    this.queue = this.queue.filter((m) => m.contactId !== contactId);
    this.opts.events?.onQueue?.(this.queue.length);
  }

  /** Pending model work for one contact. */
  pendingFor(contactId: string): number {
    return this.queue.filter((m) => m.contactId === contactId).length;
  }

  pending(): number {
    return this.queue.length;
  }

  /** Retry the model after onModelError (e.g. the user just downloaded Nano or gave cloud consent). */
  resume(tagger?: Tagger): void {
    if (tagger) this.opts.tagger = tagger;
    this.modelDown = false;
    for (const c of this.contactsById.values())
      for (const [id, t] of c.tags) if (t.route === 'rules' && !this.queue.some((q) => q.id === id)) this.queue.push(c.messages.get(id)!);
    void this.drain();
  }

  /** Resolves when the model queue is empty (tests, benchmark). */
  async idle(): Promise<void> {
    while (this.running || (this.queue.length && !this.modelDown && this.opts.tagger)) await new Promise((r) => setTimeout(r, 5));
  }

  private state(contactId: string): ContactState {
    let c = this.contactsById.get(contactId);
    if (!c) this.contactsById.set(contactId, (c = { messages: new Map(), tags: new Map(), escalated: false }));
    return c;
  }

  private rescore(contactId: string): void {
    const c = this.state(contactId);
    c.risk = scoreContact(contactId, [...c.tags.values()], this.cfg);
    this.opts.events?.onContact?.(c.risk);
    if (c.risk.shouldEscalate && !c.escalated) {
      c.escalated = true;
      this.opts.events?.onEscalate?.(c.risk);
    }
  }

  /** Riskiest contact first; within a contact, oldest first so context reads naturally. */
  private nextBatch(): ChatMessage[] {
    const score = (id: string) => this.contactsById.get(id)?.risk?.score ?? 0;
    const top = this.queue.reduce<ChatMessage | undefined>((best, m) => (!best || score(m.contactId) > score(best.contactId) ? m : best), undefined);
    if (!top) return [];
    const batch = this.queue
      .filter((m) => m.contactId === top.contactId)
      .sort((a, b) => a.sentAt - b.sentAt)
      .slice(0, this.batchSize);
    const ids = new Set(batch.map((m) => m.id));
    this.queue = this.queue.filter((m) => !ids.has(m.id));
    return batch;
  }

  private contextFor(first: ChatMessage): string[] {
    const c = this.state(first.contactId);
    return [...c.messages.values()]
      .filter((m) => m.sentAt < first.sentAt)
      .sort((a, b) => a.sentAt - b.sentAt)
      .slice(-3)
      .map((m) => `${m.fromUser ? 'You' : 'Them'}: ${m.text}`);
  }

  private async drain(): Promise<void> {
    if (this.running || this.modelDown || !this.opts.tagger) return;
    this.running = true;
    try {
      while (this.queue.length && !this.modelDown) {
        const batch = this.nextBatch();
        const contactId = batch[0]!.contactId;
        const before = this.contactsById.get(contactId);
        try {
          const tagged = await this.opts.tagger.tag(batch, this.contextFor(batch[0]!));
          const c = this.contactsById.get(contactId);
          if (!c || c !== before) continue; // forgotten (reset) while the model was working
          for (const t of tagged) {
            c.tags.set(t.messageId, t);
            this.latency.add(t.route, t.latencyMs);
            await this.cache.set(t);
          }
          this.rescore(contactId);
        } catch (err) {
          this.queue.unshift(...batch);
          this.modelDown = true;
          this.opts.events?.onModelError?.(err);
        }
        this.opts.events?.onQueue?.(this.queue.length);
      }
    } finally {
      this.running = false;
    }
  }
}
