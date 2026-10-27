import type { CrawledPageSummary } from '@/types';
import { createCrawlResultFixture, createCrawlRunFixture } from './crawl';

export const createSemanticCrawlRunFixture = (
  id: string,
  completedAt: string,
  projectId: string,
  pages: CrawledPageSummary[],
) => {
  const startUrl = pages[0]?.url ?? 'https://example.test/';
  return createCrawlRunFixture({
    id,
    projectId,
    completedAt,
    startUrl,
    result: createCrawlResultFixture({ start_url: startUrl, pages_crawled: pages.length, pages }),
  });
};
