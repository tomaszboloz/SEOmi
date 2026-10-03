import { expect, it } from 'vitest';
import type { CrawledPageSummary, CrawlRunRecord } from '../src/types';
import { compactCrawlRunsForStorage } from '../src/services/crawlPersistence/compaction';
import { compactCrawlRunsToPageIndex } from '../src/services/crawlPersistence/pageIndex';
import { createCrawlPageFixture, createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

it.each([1, 2, 3] as const)('bounds optional repeated evidence at level %i without changing the input', level => {
  const repeated = Array.from({ length: 60 }, (_, index) => ({ index }));
  const optional = Object.fromEntries([
    'semantic_links', 'semantic_excerpts', 'html_validation_findings', 'schema_validation_findings',
    'custom_search_results', 'content_terms', 'hreflangs', 'canonical_targets', 'pagination_links',
    'schema_references', 'favicon_metadata', 'favicon_resource_checks', 'social_meta_tags',
    'frames', 'discovery_sources',
  ].map(key => [key, repeated]));
  const page = { ...createCrawlPageFixture(), ...optional } as CrawledPageSummary;
  const source = createCrawlRunFixture({ result: createCrawlResultFixture({ pages: [page],
    sitemap_urls: Array.from({ length: 600 }, (_, index) => String(index)),
    rejected_urls: [], resources: [],
  }) });
  const snapshot = JSON.stringify(source);
  const [stored] = compactCrawlRunsForStorage([source], level);
  const result = stored.result.pages[0];
  expect(result.content_terms).toHaveLength(level === 1 ? 20 : level === 2 ? 8 : 3);
  expect(result.hreflangs).toHaveLength(level === 1 ? 40 : level === 2 ? 12 : 4);
  expect(result.canonical_targets).toHaveLength(level === 1 ? 20 : level === 2 ? 6 : 2);
  expect(result.pagination_links).toHaveLength(level === 1 ? 20 : level === 2 ? 6 : 2);
  expect(result.html_validation_findings).toHaveLength(level === 1 ? 40 : level === 2 ? 10 : 4);
  expect(result.schema_validation_findings).toHaveLength(level === 1 ? 40 : level === 2 ? 10 : 4);
  if (level < 3) {
    expect(result.favicon_metadata).toHaveLength(level === 1 ? 20 : 6);
    expect(result.schema_references).toHaveLength(level === 1 ? 40 : 12);
    expect(result.social_meta_tags).toHaveLength(level === 1 ? 40 : 12);
  } else {
    expect(result.favicon_metadata).toBeUndefined();
    expect(result.schema_references).toBeUndefined();
    expect(result.social_meta_tags).toBeUndefined();
  }
  expect(JSON.stringify(source)).toBe(snapshot);
});

it('tolerates missing legacy arrays without inventing page evidence', () => {
  const source = { ...createCrawlRunFixture(), result: { ...createCrawlResultFixture(), pages: undefined,
    sitemap_urls: undefined, rejected_urls: undefined } } as unknown as CrawlRunRecord;
  expect(compactCrawlRunsForStorage([source], 3)[0].result.pages).toEqual([]);
  expect(compactCrawlRunsToPageIndex([source])[0].result)
    .toMatchObject({ pages: [], sitemap_urls: [], storage_pages_total: 0 });
  const page = { ...createCrawlPageFixture(), links: undefined, images: undefined, issues: undefined };
  source.result.pages = [page as unknown as CrawledPageSummary];
  expect(compactCrawlRunsForStorage([source], 3)[0].result.pages[0])
    .toMatchObject({ links: [], images: [], issues: [] });
});
