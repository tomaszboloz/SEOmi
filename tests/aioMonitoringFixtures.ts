import type { CrawledPageSummary, CrawlRunRecord } from '@/types';
import { GOOD_PAGE, WEAK_PAGE } from './aioFixtures';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { aioRProfile } from '@/services/aioReadiness';

export { GOOD_PAGE, WEAK_PAGE };
export const aioRun = (
  id = 'before', pages: CrawledPageSummary[] = [GOOD_PAGE], patch: Partial<CrawlRunRecord> = {},
): CrawlRunRecord => createCrawlRunFixture({
  id, projectId: 'aio-project', completedAt: id === 'before' ? '2026-10-01T00:00:00Z' : '2026-10-02T00:00:00Z',
  result: createCrawlResultFixture({ pages, pages_crawled: pages.length, aio_profile: aioRProfile('und', 'und') }), ...patch,
});

export const beforeAio = () => aioRun();
export const afterAio = (id = 'after') => aioRun(id, [WEAK_PAGE]);
