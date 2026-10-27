import { CrawlEventLog, type CrawlEvent, type EventSink, type Reducer } from './eventLog';
import { persistCrawlEvents } from './sqliteEventSink';

/**
 * A CrawlEventLog bound to a specific project and run that flushes appended
 * events down to SQLite storage in strict sequence order.
 */
export class PersistentCrawlEventLog {
  readonly projectId: string;
  readonly runId: string;
  private readonly inner: CrawlEventLog;
  private pending: CrawlEvent[] = [];
  private currentFlush: Promise<void> | null = null;

  constructor(projectId: string, runId: string, initial: CrawlEvent[] = []) {
    this.projectId = projectId;
    this.runId = runId;
    this.inner = new CrawlEventLog(initial);
  }

  get revision(): number {
    return this.inner.revision;
  }

  allEvents(): readonly CrawlEvent[] {
    return this.inner.allEvents();
  }

  append<P>(type: string, payload: P, now: () => Date = () => new Date()): CrawlEvent<P> {
    const event = this.inner.append(type, payload, now);
    this.pending.push(event);
    void this.scheduleFlush().catch(() => {});
    return event;
  }

  subscribe(sink: EventSink): () => void {
    return this.inner.subscribe(sink);
  }

  project<S>(reducer: Reducer<S>, initial: () => S, upTo?: number): S {
    return this.inner.project(reducer, initial, upTo);
  }

  private scheduleFlush(): Promise<void> {
    if (this.currentFlush) return this.currentFlush;
    this.currentFlush = (async () => {
      while (this.pending.length > 0) {
        const batch = [...this.pending];
        this.pending = [];
        try {
          await persistCrawlEvents(this.projectId, this.runId, batch);
        } catch (err) {
          this.pending.unshift(...batch);
          throw err;
        }
      }
    })().finally(() => {
      this.currentFlush = null;
    });
    return this.currentFlush;
  }

  /** Waits for all in-flight persistence writes to commit. */
  async flush(): Promise<void> {
    while (this.pending.length > 0 || this.currentFlush) {
      if (this.currentFlush) {
        await this.currentFlush;
      } else {
        await this.scheduleFlush();
      }
    }
  }
}
