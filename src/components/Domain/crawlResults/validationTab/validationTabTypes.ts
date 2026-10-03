import type { useCrawlResultsSession } from '../useCrawlResultsSession';
import type { CrawledHtmlValidationFinding, CrawledPageSummary } from '@/types';

export type Session = ReturnType<typeof useCrawlResultsSession>;

export interface FilteredValidationPage {
  page: CrawledPageSummary;
  findings: CrawledHtmlValidationFinding[];
  pageMatches: boolean;
}
