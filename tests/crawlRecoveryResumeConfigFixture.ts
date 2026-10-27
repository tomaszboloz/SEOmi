import type { InterruptedCrawl } from '@/stores/tools/contracts';
import type { CrawlConfig } from '@/types';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';

export const createRecoveredPagesFixture = () => {
  const p1 = createCrawlPageFixture({ url: 'https://example.test/p1', final_url: 'https://example.test/p1' });
  const p2 = createCrawlPageFixture({ url: 'https://example.test/p2', final_url: 'https://example.test/p2' });
  const p3 = createCrawlPageFixture({ url: 'https://example.test/p3', final_url: 'https://example.test/p3' });
  const baseResult = createCrawlResultFixture({
    start_url: 'https://example.test/',
    pages_crawled: 2,
    pages: [p1, p2],
  });
  return { p1, p2, p3, baseResult };
};

export const createInterruptedCheckpointFixture = (
  patch: Partial<InterruptedCrawl> = {},
): InterruptedCrawl => {
  const { baseResult } = createRecoveredPagesFixture();
  return {
    url: 'https://example.test/',
    limit: 25,
    config: undefined as unknown as CrawlConfig,
    environment: 'default',
    startedAt: undefined as unknown as string,
    updatedAt: undefined as unknown as string,
    completedUrls: ['https://example.test/p1', 'https://example.test/p2'],
    frontierUrls: ['https://example.test/p3'],
    baseRunId: 'recovered-in-flight',
    baseResult,
    ...patch,
  };
};
