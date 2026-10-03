import type { CrawledPageSummary } from '@/types';
import type { useCrawlResultsSession } from '../useCrawlResultsSession';

export type SocialSession = ReturnType<typeof useCrawlResultsSession>;

export const isSocialPage = (page: CrawledPageSummary): boolean =>
  (page.favicons?.length || page.favicon_metadata?.length || 0) > 0 ||
  (page.social_meta_tags?.length || 0) > 0;
