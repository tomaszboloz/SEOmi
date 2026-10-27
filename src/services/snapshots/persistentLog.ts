import { CrawlEventLog, type CrawlEvent, type EventSink, type Reducer } from './eventLog';
import { persistCrawlEvents } from './sqliteEventSink';

export class PersistentCrawlEventLog {
  readonly projectId: string;
  readonly runId: string;
  private readonly inner: CrawlEventLog;
  private pending: CrawlEvent[] = [];
  private currentFlush: Promise<void> | null = null;

  constructor(projectId: string, runId: string, initial: CrawlEvent[] = []) {
    this.projectId = projectId;
    this.runId = runId;
    this.inner = new CrawlEventLog(initial, { projectId, runId });
  }

  get revision(): number { return this.inner.revision; }
  allEvents(): readonly CrawlEvent[] { return this.inner.allEvents(); }
  subscribe(sink: EventSink): () => void { return this.inner.subscribe(sink); }
  project<S>(reducer: Reducer<S>, initial: () => S, upTo?: number): S { return this.inner.project(reducer, initial, upTo); }

  append<P>(type: string, payload: P, now: () => Date = () => new Date()): CrawlEvent<P> {
    const event = this.inner.append(type, payload, now);
    this.pending.push(event);
    void this.scheduleFlush().catch(() => undefined);
    return event;
  }

  private scheduleFlush(): Promise<void> {
    if (this.currentFlush) return this.currentFlush;
    this.currentFlush = (async () => {
      while (this.pending.length) {
        const batch = this.pending.splice(0);
        try { await persistCrawlEvents(this.projectId, this.runId, batch); }
        catch (error) { this.pending.unshift(...batch); throw error; }
      }
    })().finally(() => { this.currentFlush = null; });
    return this.currentFlush;
  }

  async flush(): Promise<void> {
    while (this.pending.length || this.currentFlush) {
      if (this.currentFlush) await this.currentFlush;
      else await this.scheduleFlush();
    }
  }
}
