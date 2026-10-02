import type { CrawledPageSummary } from '@/types';
import type { useCrawlResultsSession } from '../useCrawlResultsSession';

export type DirectivesSession = ReturnType<typeof useCrawlResultsSession>;

export interface CrawlClientRedirectItem {
  page: CrawledPageSummary;
  redirect: NonNullable<CrawledPageSummary['client_redirects']>[number];
  key: string;
}
