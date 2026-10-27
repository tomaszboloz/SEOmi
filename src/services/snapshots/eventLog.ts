import { freezeCopy } from './freeze';

export interface CrawlEvent<P = unknown> {
  readonly seq: number;
  readonly type: string;
  readonly at: string;
  readonly payload: Readonly<P>;
}

export type EventSink = (event: CrawlEvent) => void;
export type Reducer<S> = (state: S, event: CrawlEvent) => S;

/**
 * Append-only write side (CQRS lite). Events are frozen copies; the read
 * view is rebuilt by folding the log, never edited in place.
 */
export class CrawlEventLog {
  private events: CrawlEvent[] = [];
  private readonly sinks = new Set<EventSink>();

  get revision(): number {
    return this.events.length;
  }

  append<P>(type: string, payload: P, now: () => Date = () => new Date()): CrawlEvent<P> {
    const event: CrawlEvent<P> = Object.freeze({
      seq: this.events.length + 1, type, at: now().toISOString(), payload: freezeCopy(payload),
    });
    this.events.push(event);
    this.sinks.forEach((sink) => sink(event));
    return event;
  }

  subscribe(sink: EventSink): () => void {
    this.sinks.add(sink);
    return () => { this.sinks.delete(sink); };
  }

  /** Read view at an optional revision; builds a fresh state each call. */
  project<S>(reducer: Reducer<S>, initial: () => S, upTo: number = this.events.length): S {
    return this.events.slice(0, upTo).reduce(reducer, initial());
  }
}
