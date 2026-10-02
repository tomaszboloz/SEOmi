import { describe, expect, it } from 'vitest';
import { compactCrawlRunsForStorage } from '../src/services/crawlPersistence/compaction';
import { compactCrawlRunsToPageIndex } from '../src/services/crawlPersistence/pageIndex';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

describe('durable crawl evidence', () => {
  it('retains ten identifying links and images in the final evidence retry', () => {
    const page = createCrawlPageFixture({
      links: Array.from({ length: 20 }, (_, index) => ({
        target_url: `https://example.test/${index}`, is_internal: true, anchor_text: 'Navigation',
      })),
      images: Array.from({ length: 20 }, (_, index) => ({
        src: `https://example.test/${index}.png`, alt: 'Image', lazy_loaded: false,
      })),
    });
    const source = createCrawlRunFixture({ result: createCrawlResultFixture({ pages: [page] }) });
    const [stored] = compactCrawlRunsForStorage([source], 3);
    expect(stored.result.pages[0].links).toEqual(page.links.slice(0, 10));
    expect(stored.result.pages[0].images).toEqual(page.images.slice(0, 10));
    expect(stored.storage_compacted).toBe(true);
    expect(source.result.pages[0].links).toHaveLength(20);
  });

  it('stores only the newest 250-page index and explicitly reports omitted pages', () => {
    const pages = Array.from({ length: 251 }, (_, index) => createCrawlPageFixture({
      url: `https://example.test/${index}`,
      issues: [{ severity: 'Warning', code: 'first', message: 'First' },
        { severity: 'Warning', code: 'second', message: 'Second' }],
    }));
    const source = createCrawlRunFixture({ result: createCrawlResultFixture({ pages }) });
    const stored = compactCrawlRunsToPageIndex([source, createCrawlRunFixture({ id: 'older' })]);
    expect(stored).toHaveLength(1);
    expect(stored[0].result.pages).toHaveLength(250);
    expect(stored[0].result).toMatchObject({ storage_pages_total: 251, storage_pages_truncated: true });
    expect(stored[0].result.pages[0].issues).toEqual([pages[0].issues[0]]);
    expect(source.result.pages).toHaveLength(251);
  });

  it('does not mark a complete small page index as truncated', () => {
    const source = createCrawlRunFixture();
    expect(compactCrawlRunsToPageIndex([source])[0].result)
      .toMatchObject({ storage_pages_total: 0, storage_pages_truncated: false });
    expect(compactCrawlRunsToPageIndex([])).toEqual([]);
  });
});
