import { CrawledPageSummarySchema } from '@/services/contracts/crawl';
import type { CrawledPageSummary, SiteCrawlResult } from '@/types';
import type { CrawlLogEvent } from './nativeLog';

const TERMINAL = new Set(['completed', 'cancelled', 'timed_out', 'failed', 'interrupted']);

/** Pages a crawl had finished before the app stopped, rebuilt only from logged events. */
export interface RecoveredCrawl {
  runId: string;
  startUrl: string;
  startedAtMs: number;
  lastAtMs: number;
  pages: CrawledPageSummary[];
  /** Logged pages that no longer match the page contract; reported, never guessed. */
  invalidPages: number;
}

/** Only the fields `mergeCrawlResults` reads from the earlier part of a resumed crawl. */
export type CrawlResumeBase = Pick<SiteCrawlResult, 'start_url' | 'pages' | 'duration_ms'>
  & Partial<Pick<SiteCrawlResult, 'sitemap_urls' | 'rejected_urls' | 'resources' | 'resource_limit_reached'>>;

export const replayCrawlLog = (runId: string, events: CrawlLogEvent[]): RecoveredCrawl => {
  const [started] = events;
  const startUrl = (started?.payload as { start_url?: unknown } | null)?.start_url;
  if (started?.kind !== 'started' || typeof startUrl !== 'string' || !startUrl) {
    throw new Error(`Crawl event log for run ${runId} does not begin with a started event.`);
  }
  const closed = events.find((event) => TERMINAL.has(event.kind));
  if (closed) throw new Error(`Crawl event log for run ${runId} is already ${closed.kind}.`);
  const pages: CrawledPageSummary[] = [];
  let invalidPages = 0;
  for (const event of events) {
    if (event.kind !== 'page') continue;
    const parsed = CrawledPageSummarySchema.safeParse((event.payload as { page?: unknown } | null)?.page);
    if (parsed.success) pages.push(parsed.data as CrawledPageSummary);
    else invalidPages += 1;
  }
  return { runId, startUrl, startedAtMs: started.at_ms, lastAtMs: events[events.length - 1].at_ms, pages, invalidPages };
};

/** Earlier part of a resumed crawl; duration is the logged span, not an estimate. */
export const recoveredResumeBase = (recovered: RecoveredCrawl): CrawlResumeBase => ({
  start_url: recovered.startUrl,
  pages: recovered.pages,
  duration_ms: Math.max(0, recovered.lastAtMs - recovered.startedAtMs),
});
