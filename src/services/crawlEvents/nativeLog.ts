import { invokeTauriCommand } from '@/services/tauri';

/** One event of the native append-only crawl log (#138). */
export interface CrawlLogEvent { seq: number; kind: string; at_ms: number; payload: unknown }
export interface OpenCrawlLog { run_id: string; last_seq: number; pages: number; started_at_ms: number; last_at_ms: number }

const PAGE = 500;
/** Hard stop for a corrupted log; a real run has at most a few hundred thousand pages. */
const MAX_EVENTS = 1_000_000;

const isInt = (value: unknown): value is number => Number.isSafeInteger(value);

const isEvent = (value: unknown): value is CrawlLogEvent => {
  const event = value as CrawlLogEvent | null;
  return Boolean(event) && isInt(event!.seq) && typeof event!.kind === 'string' && isInt(event!.at_ms);
};

export const listOpenCrawlLogs = async (projectId: string): Promise<OpenCrawlLog[]> => {
  const rows = await invokeTauriCommand<unknown>('store_list_open_crawl_event_runs', { projectId });
  if (!Array.isArray(rows)) throw new Error('Crawl event log returned an invalid run list.');
  return rows.filter((row): row is OpenCrawlLog => Boolean(row) && typeof row.run_id === 'string' && row.run_id.length > 0
    && isInt(row.last_seq) && isInt(row.pages) && isInt(row.started_at_ms) && isInt(row.last_at_ms));
};

/**
 * Every event of one pinned run, in order. Each page must belong to the same run
 * and continue the sequence; a gap or a foreign page fails instead of being skipped.
 */
export const loadCrawlLog = async (projectId: string, runId: string): Promise<CrawlLogEvent[]> => {
  if (!runId) throw new Error('Loading a crawl event log needs an explicit run id.');
  const events: CrawlLogEvent[] = [];
  for (;;) {
    const afterSeq = events.length;
    const page = await invokeTauriCommand<{ run_id?: unknown; events?: unknown; has_more?: unknown }>(
      'store_load_crawl_events', { projectId, runId, afterSeq, limit: PAGE },
    );
    if (!page || page.run_id !== runId || !Array.isArray(page.events) || typeof page.has_more !== 'boolean') {
      throw new Error(`Crawl event log for run ${runId} returned an invalid page.`);
    }
    for (const event of page.events) {
      if (!isEvent(event) || event.seq !== events.length + 1) {
        throw new Error(`Crawl event log for run ${runId} has a gap after event ${events.length}.`);
      }
      events.push(event);
    }
    if (!page.has_more) return events;
    if (page.events.length === 0 || events.length >= MAX_EVENTS) {
      throw new Error(`Crawl event log for run ${runId} did not finish paging.`);
    }
  }
};

/** Marks an orphaned log as interrupted so it is not offered again. */
export const closeInterruptedCrawlLog = (projectId: string, runId: string, now: () => number = Date.now): Promise<void> =>
  invokeTauriCommand<void>('store_close_interrupted_crawl_events', { projectId, runId, atMs: now() });
