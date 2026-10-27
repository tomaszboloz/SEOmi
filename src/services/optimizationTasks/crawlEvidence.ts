import type { CrawlRunRecord, CrawledPageSummary } from '@/types';

const validObservedStart = (value: string | undefined): boolean =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

/** Migration/import ids carry an import timestamp, not observed crawl completion. */
const hasObservedCompletion = (run: CrawlRunRecord): boolean => {
  const id = typeof run.id === 'string' ? run.id : '';
  if (id.startsWith('legacy-')) return false;
  if (id.startsWith('scheduled-crawl-') && !validObservedStart(run.startedAt)) return false;
  // Compacted/page-index snapshots are navigable history, not full evidence.
  return !run.storage_compacted && run.result?.storage_pages_truncated !== true;
};

/** A crawl can supply task evidence only after a real, non-partial completion. */
export const isCompletedCrawlRun = (run?: CrawlRunRecord | null): run is CrawlRunRecord => Boolean(
  run
  && hasObservedCompletion(run)
  && !run.result?.cancelled
  && run.result?.timed_out !== true
  && typeof run.completedAt === 'string'
  && Number.isFinite(Date.parse(run.completedAt)),
);

/** UI guard: the displayed pages must be the pages of the completed selected run. */
export const isSelectedCompletedCrawl = (run: CrawlRunRecord | null | undefined, pages: readonly CrawledPageSummary[]): boolean =>
  isCompletedCrawlRun(run) && run.result.pages === pages;
