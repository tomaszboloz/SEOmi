import { describe, expect, it } from 'vitest';
import { compareCrawlRuns, crawlComparisonKey } from '@/services/crawlDiff';
import type { CrawledPageSummary } from '@/types';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

const duplicateRun = createCrawlRunFixture({
  id: 'current', projectId: 'project-a',
  result: createCrawlResultFixture({
    pages: [createCrawlPageFixture({ url: 'https://example.test/a' }), createCrawlPageFixture({ url: 'https://example.test/a' })],
    pages_crawled: 2,
  }),
});

describe('crawl diff collision contract', () => {
  it.each([undefined, null, 42, '', '   '])('blocks malformed page URL %s in both matching modes', (url) => {
    const baseline = createCrawlRunFixture({ id: 'baseline', projectId: 'project-a' });
    const current = createCrawlRunFixture({ id: 'current', projectId: 'project-a', result: createCrawlResultFixture({ pages: [{ ...createCrawlPageFixture(), url } as unknown as CrawledPageSummary] }) });
    for (const matchByPath of [false, true]) {
      const result = compareCrawlRuns(current, baseline, { projectId: 'project-a', matchByPath });
      expect(result.status).toBe('blocked');
      expect(result.reasons).toContain('invalid-page-url');
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
      expect(result.collisions).toEqual([{ key: '', side: 'current', urls: [], invalid: true }]);
      expect(crawlComparisonKey(url as string, matchByPath)).toBe('');
    }
  });
  it('blocks duplicate URL keys in both full URL and path modes', () => {
    const baseline = createCrawlRunFixture({ id: 'baseline', projectId: 'project-a' });
    const full = compareCrawlRuns(duplicateRun, baseline, { projectId: 'project-a' });
    expect(full.status).toBe('blocked');
    expect(full.reasons).toContain('url-key-collision');
    const path = compareCrawlRuns(duplicateRun, baseline, { projectId: 'project-a', matchByPath: true });
    expect(path.status).toBe('blocked');
    expect(path.reasons).toContain('path-key-collision');
  });
});
