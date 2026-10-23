import type { CrawlRunRecord } from '@/types';
import { invokeTauriCommand } from '@/services/tauri';
import { parseCrawlRunsStrict } from '../crawlContracts';
import i18n from '@/i18n';

const MAX_RUNS = 50;

/** Run metadata as listed by SQLite: result.pages is empty, pageCount is the real total. */
export interface StoredRunSummary { id: string; completedAt: string; startUrl: string; pageCount: number }

export const listStoredRuns = async (projectId: string): Promise<StoredRunSummary[]> => {
  const rows = await invokeTauriCommand<StoredRunSummary[]>('store_list_crawl_runs', { projectId });
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string' || !row.id.trim()
    || typeof row.completedAt !== 'string' || typeof row.startUrl !== 'string'
    || !Number.isSafeInteger(row.pageCount) || row.pageCount < 0)
    || new Set(rows.map(row => row.id)).size !== rows.length) {
    throw new Error(i18n.t('runtimeErrors.persistence.historyReadFailed'));
  }
  return rows.map(({ id, completedAt, startUrl, pageCount }) => ({ id, completedAt, startUrl, pageCount }));
};

/** Lazy single-run load: every page, no truncation. */
export const loadStoredRun = async (projectId: string, runId: string): Promise<CrawlRunRecord | null> => {
  const raw = await invokeTauriCommand<unknown>('store_load_crawl_run', { projectId, runId });
  if (raw === null) return null;
  const run = parseCrawlRunsStrict([raw])[0];
  if (run.id !== runId) throw new Error(i18n.t('runtimeErrors.persistence.historyReadFailed'));
  return run;
};

/** Streams a page window of one run for 10k-100k URL domains. */
export const loadStoredPages = (projectId: string, runId: string, offset: number, limit: number): Promise<unknown[]> =>
  invokeTauriCommand<unknown[]>('store_load_crawl_pages', { projectId, runId, offset, limit });

export const loadStoredRuns = async (projectId: string): Promise<CrawlRunRecord[]> => {
  const summaries = await listStoredRuns(projectId);
  const runs = await Promise.all(summaries.map((summary) => loadStoredRun(projectId, summary.id)));
  if (runs.some((run, index) => run === null || run.result.pages.length !== summaries[index].pageCount)) {
    throw new Error(i18n.t('runtimeErrors.persistence.historyReadFailed'));
  }
  return runs as CrawlRunRecord[];
};

/** Replace the whole snapshot atomically; a failed write preserves every old run. */
export const saveStoredRuns = async (projectId: string, runs: CrawlRunRecord[]): Promise<void> => {
  const kept = runs.slice(0, MAX_RUNS);
  parseCrawlRunsStrict(kept);
  await invokeTauriCommand<void>('store_replace_crawl_runs', { projectId, runs: kept });
};
