import { beforeEach, expect, it } from 'vitest';
import { normalizeInterruptedCrawl, loadCrawlRequestProfiles, buildCrawlCheckpoint, mergeCrawlResults,
  DEFAULT_CRAWL_CONFIG } from '@/stores/tools/crawlPersistence';
import { useProjectStore } from '@/stores/projectStore';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
beforeEach(() => { localStorage.clear(); useProjectStore.setState({ activeProjectId: 'checkpoint-edges' }); });

it('rejects malformed configuration and gives invalid checkpoint dates no current-time evidence', () => {
  const value = { url: 'https://example.test/', limit: 5, config: DEFAULT_CRAWL_CONFIG };
  expect(normalizeInterruptedCrawl({ ...value, config: { includePatterns: false } })).toBeNull();
  expect(normalizeInterruptedCrawl({ ...value, startedAt: 'invalid' }))
    .toMatchObject({ startedAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' });
});

it('contains a non-array persisted profile record without inventing a profile', () => {
  localStorage.setItem('seomi_project_checkpoint-edges_crawl_request_profiles_v1', JSON.stringify({ id: 'invalid' }));
  expect(loadCrawlRequestProfiles()).toEqual([]);
});

it('keeps legacy evidence omissions empty when constructing a resumable frontier', () => {
  const page = createCrawlPageFixture({ final_url: '' });
  const result = { ...createCrawlResultFixture(), pages: [{ ...page, links: undefined }], sitemap_urls: undefined };
  expect(buildCrawlCheckpoint(result as never)).toEqual({ completedUrls: ['https://example.test/'], frontierUrls: [] });
});

it('merges missing legacy evidence, actual resources and empty final URLs without creating findings', () => {
  const resource = { source_urls: [], url: 'https://example.test/asset#first', resource_type: 'image' };
  const base = { ...createCrawlResultFixture(), start_url: '', sitemap_urls: undefined,
    pages: [{ ...createCrawlPageFixture(), final_url: '', issues: undefined }], resources: [resource] };
  const fresh = { ...createCrawlResultFixture(), sitemap_urls: undefined,
    pages: [{ ...createCrawlPageFixture(), final_url: '', issues: undefined }],
    resources: [{ ...resource, url: 'https://example.test/asset#second', http_status: 200 }] };
  const result = mergeCrawlResults(base as never, fresh as never);
  expect(result).toMatchObject({ start_url: 'https://example.test/', critical_count: 0, warning_count: 0,
    notice_count: 0, sitemap_urls: [], rejected_urls: [], resource_limit_reached: false });
  expect(result.resources).toHaveLength(1);
  expect(result.resources?.[0].http_status).toBe(200);
  expect(mergeCrawlResults(createCrawlResultFixture(), createCrawlResultFixture()).resources).toEqual([]);
});

it.each([{ url: '' }, { url: 1 }, { limit: NaN }, { limit: 'invalid' }, { config: null }, { config: 'invalid' }])(
  'rejects malformed checkpoint identity or limits: %j', patch => {
    expect(normalizeInterruptedCrawl({ url: 'https://example.test/', limit: 5, config: DEFAULT_CRAWL_CONFIG, ...patch })).toBeNull();
  },
);
