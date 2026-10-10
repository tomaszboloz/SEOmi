import { describe, expect, it } from 'vitest';
import { compareCrawlRuns } from '@/services/crawlDiff';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

describe('crawl diff malformed page URL contract', () => {
  it('blocks path comparison and preserves invalid URL evidence', () => {
    const current = createCrawlRunFixture({
      id: 'current', projectId: 'project-invalid-page-url',
      result: createCrawlResultFixture({
        pages: [createCrawlPageFixture({ url: undefined as never, final_url: undefined as never })],
        pages_crawled: 1,
      }),
    });
    const baseline = createCrawlRunFixture({ id: 'baseline', projectId: 'project-invalid-page-url' });

    expect(() => compareCrawlRuns(current, baseline, { projectId: 'project-invalid-page-url', matchByPath: true })).not.toThrow();
    const report = compareCrawlRuns(current, baseline, { projectId: 'project-invalid-page-url', matchByPath: true });
    expect(report.status).toBe('blocked');
    expect(report.reasons).toContain('invalid-page-url');
    expect(report.collisions).toHaveLength(1);
    expect(report.collisions?.[0]).toMatchObject({ side: 'current' });
  });
});
