import type { ExternalLinkCheckBatchResult } from '@/types';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './crawl';

export const externalRun = (id = 'external-run') => createCrawlRunFixture({ id,
  result: createCrawlResultFixture({ pages_crawled: 1, pages: [createCrawlPageFixture({
    external_link_count: 1,
    links: [{ target_url: 'https://outside.example/path#source', anchor_text: 'Outside', is_internal: false }],
  })] }),
});

export const checkedBatch: ExternalLinkCheckBatchResult = {
  requested: 1, checked: 1, omitted: 0,
  results: [{ url: 'https://outside.example/path', httpStatus: 404, checkedAt: '2026-10-02T10:00:00Z' }],
};
