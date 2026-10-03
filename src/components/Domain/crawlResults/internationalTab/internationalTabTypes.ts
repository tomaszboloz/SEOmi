import type { useCrawlResultsSession } from '../useCrawlResultsSession';
import type { CrawledPageSummary } from '@/types';

export type Session = ReturnType<typeof useCrawlResultsSession>;

export interface CrawlInternationalSectionProps {
  pages: CrawledPageSummary[];
  t: Session['t'];
}
