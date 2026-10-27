import type { CrawlRunRecord, CrawledPageSummary } from '@/types';

/** A crawl can supply task evidence only after a real, non-partial completion. */
export const isCompletedCrawlRun = (run?: CrawlRunRecord | null): run is CrawlRunRecord => Boolean(
  run
  && !run.result?.cancelled
  && run.result?.timed_out !== true
  && typeof run.completedAt === 'string'
  && Number.isFinite(Date.parse(run.completedAt)),
);

/** UI guard: the displayed pages must be the pages of the completed selected run. */
export const isSelectedCompletedCrawl = (run: CrawlRunRecord | null | undefined, pages: readonly CrawledPageSummary[]): boolean =>
  isCompletedCrawlRun(run) && run.result.pages === pages;
