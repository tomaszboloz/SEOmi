import type { CrawlRunRecord } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import { parseCrawlRuns } from '../crawlContracts';

const MAX_RUNS = 50;

/** Run metadata as listed by SQLite: result.pages is empty, pageCount is the real total. */
export interface StoredRunSummary { id: string; completedAt: string; startUrl: string; pageCount: number }

export const listStoredRuns = async (projectId: string): Promise<StoredRunSummary[]> => {
  const rows = await invokeTauriCommand<Array<Record<string, unknown>>>('store_list_crawl_runs', { projectId });
  return rows.map((row) => ({
    id: String(row.id ?? ''), completedAt: String(row.completedAt ?? ''),
    startUrl: String(row.startUrl ?? ''), pageCount: Number(row.pageCount ?? 0),
  }));
};

/** Lazy single-run load: every page, no truncation. */
export const loadStoredRun = async (projectId: string, runId: string): Promise<CrawlRunRecord | null> => {
  const raw = await invokeTauriCommand<unknown>('store_load_crawl_run', { projectId, runId });
  return raw ? parseCrawlRuns([raw])[0] ?? null : null;
};

/** Streams a page window of one run for 10k-100k URL domains. */
export const loadStoredPages = (projectId: string, runId: string, offset: number, limit: number): Promise<unknown[]> =>
  invokeTauriCommand<unknown[]>('store_load_crawl_pages', { projectId, runId, offset, limit });

export const loadStoredRuns = async (projectId: string): Promise<CrawlRunRecord[]> => {
  const summaries = await listStoredRuns(projectId);
  const runs = await Promise.all(summaries.map((summary) => loadStoredRun(projectId, summary.id)));
  return runs.filter((run): run is CrawlRunRecord => run !== null);
};

/** Upserts every run and deletes stored runs missing from the list (cap 50). */
export const saveStoredRuns = async (projectId: string, runs: CrawlRunRecord[]): Promise<void> => {
  const kept = runs.slice(0, MAX_RUNS);
  const keepIds = new Set(kept.map((run) => run.id));
  const existing = await listStoredRuns(projectId);
  await Promise.all(kept.map((run) => invokeTauriCommand<void>('store_save_crawl_run', { projectId, run })));
  await Promise.all(existing.filter((row) => !keepIds.has(row.id))
    .map((row) => invokeTauriCommand<void>('store_delete_crawl_run', { projectId, runId: row.id })));
};
