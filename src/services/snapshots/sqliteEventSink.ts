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

const requireIdentity = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid crawl event ${name}.`);
  return value;
};

const mapWire = (raw: StoredCrawlEventWire, projectId: string, runId?: string): CrawlEvent => {
  if (raw.projectId !== projectId || (runId && raw.runId !== runId)) throw new Error('Crawl event identity mismatch.');
  if (!Number.isSafeInteger(raw.seq) || raw.seq < 1 || !raw.eventType || !raw.at) throw new Error('Invalid crawl event row.');
  return { seq: raw.seq, type: raw.eventType, at: raw.at, payload: raw.payload, projectId: raw.projectId, runId: raw.runId };
};

export const persistCrawlEvents = async (projectId: string, runId: string, events: CrawlEvent[]): Promise<number> => {
  requireIdentity(projectId, 'projectId');
  requireIdentity(runId, 'runId');
  if (!events.length) return 0;
  if (!isTauriEnvironment()) throw new Error('Durable SQLite event persistence requires Tauri environment.');
  const wire = events.map((event): StoredCrawlEventWire => {
    if ((event.projectId && event.projectId !== projectId) || (event.runId && event.runId !== runId)) throw new Error('Crawl event identity mismatch.');
    return { projectId, runId, seq: event.seq, eventType: event.type, at: event.at, payload: event.payload };
  });
  return invokeTauriCommand<number>('store_append_crawl_events', { projectId, runId, events: wire });
};

export const fetchCrawlEvents = async (projectId: string, runId: string, fromSeq = 1, limit = 10_000): Promise<CrawlEvent[]> => {
  requireIdentity(projectId, 'projectId');
  if (!isTauriEnvironment()) throw new Error('SQLite event reading requires Tauri environment.');
  const rows = await invokeTauriCommand<StoredCrawlEventWire[]>('store_load_crawl_events', { projectId, runId, fromSeq, limit });
  if (!Array.isArray(rows)) throw new Error('Invalid crawl event response.');
  return rows.map((row) => mapWire(row, projectId, runId || undefined));
};
