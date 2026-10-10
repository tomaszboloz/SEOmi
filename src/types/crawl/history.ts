import type { CrawlConfig } from './configuration';
import type { SiteCrawlResult } from './result';

export interface CrawlProgress {
  runId: string;
  currentUrl?: string;
  discovered: number;
  completed: number;
  queued: number;
  cancelled: boolean;
  paused: boolean;
  /** Monotonic elapsed time measured by the crawler, not wall-clock input. */
  elapsedMs?: number;
  /** Completed pages per second over the current crawl window. */
  pagesPerSecond?: number;
}

export type CrawlEnvironment = 'default' | 'staging' | 'production';

export interface CrawlRunRecord {
  id: string;
  /** Project ownership is persisted so cross-project comparisons fail closed. */
  projectId?: string;
  completedAt: string;
  startUrl: string;
  config: CrawlConfig;
  result: SiteCrawlResult;
  /** Optional environment label used by paired staging/production comparisons. */
  environment?: 'default' | 'staging' | 'production';
  /** True when persistence had to bound verbose evidence to recover from a storage quota. */
  storage_compacted?: boolean;
}
