import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri';
import type { CrawlEvent } from './eventLog';

export interface StoredCrawlEventWire {
  projectId: string;
  runId: string;
  seq: number;
  eventType: string;
  at: string;
  payload: unknown;
}

const mapWireToEvent = (raw: StoredCrawlEventWire): CrawlEvent => ({
  seq: raw.seq,
  type: raw.eventType,
  at: raw.at,
  payload: raw.payload as any,
  runId: raw.runId,
  projectId: raw.projectId,
});

const mapEventToWire = (
  projectId: string,
  runId: string,
  event: CrawlEvent,
): StoredCrawlEventWire => ({
  projectId: event.projectId ?? projectId,
  runId: event.runId ?? runId,
  seq: event.seq,
  eventType: event.type,
  at: event.at,
  payload: event.payload,
});

/** Persists an ordered sequence of events to SQLite atomically. */
export const persistCrawlEvents = async (
  projectId: string,
  runId: string,
  events: CrawlEvent[],
): Promise<number> => {
  if (!events.length) return 0;
  if (!isTauriEnvironment()) {
    throw new Error('Durable SQLite event persistence requires Tauri environment.');
  }
  const wire = events.map((ev) => mapEventToWire(projectId, runId, ev));
  return invokeTauriCommand<number>('store_append_crawl_events', {
    projectId,
    runId,
    events: wire,
  });
};

/** Loads ordered events from SQLite starting from seq. */
export const fetchCrawlEvents = async (
  projectId: string,
  runId: string,
  fromSeq = 1,
  limit = 10_000,
): Promise<CrawlEvent[]> => {
  if (!isTauriEnvironment()) {
    throw new Error('SQLite event reading requires Tauri environment.');
  }
  const rows = await invokeTauriCommand<StoredCrawlEventWire[]>('store_load_crawl_events', {
    projectId,
    runId,
    fromSeq,
    limit,
  });
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map(mapWireToEvent);
};
