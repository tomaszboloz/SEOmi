import { expect, it } from 'vitest';
import { decodeCrawlRunsFromStorage } from '@/services/crawlPersistence';
import { DEFAULT_CRAWL_CONFIG, normalizeInterruptedCrawl } from '@/stores/tools/crawlPersistence';
import type { CrawlRunRecord } from '@/types';
import { loadFilterPresets } from '@/components/Domain/crawlResults/crawlResultsHelpers';
import { savedKeywordSchema } from '@/services/contracts/savedKeywords';
import { keywordClusteringResultSchema } from '@/services/contracts/keywordClustering';

const run: CrawlRunRecord = {
  id: 'contract-fixture', completedAt: '2026-10-01T00:00:00Z', startUrl: 'https://example.com',
  config: DEFAULT_CRAWL_CONFIG,
  result: { start_url: 'https://example.com', pages_crawled: 0, health_score: 0,
    critical_count: 0, warning_count: 0, notice_count: 0, pages: [], duration_ms: 0,
    cancelled: false, robots_txt_status: 'unavailable', robots_blocked_count: 0,
    sitemap_status: 'unavailable', sitemap_urls_discovered: 0, sitemap_urls: [] },
};

it('keeps valid zero-valued snapshots while recovering invalid history independently', async () => {
  expect(await decodeCrawlRunsFromStorage([null, run, { id: 'bad', result: { start_url: 'https://example.com' } }])).toEqual([run]);
});

it.each([
  { pages: {} }, { sitemap_urls: [null] }, { robots_agent_matrix: [{ user_agent: 'bot', applicable_rules: {} }] },
  { resources: [{ url: 'https://example.com/a', source_urls: 5, resource_type: 'image' }] },
])('rejects nested invalid result data: %j', async patch => {
  expect(await decodeCrawlRunsFromStorage([{ ...run, result: { ...run.result, ...patch } }])).toEqual([]);
});

it.each([{ includePatterns: 123 }, { respectRobots: 'false' }, { customSearches: [{ id: 'x', query: [] }] }])(
  'rejects malformed checkpoint configuration: %j', config => {
    expect(normalizeInterruptedCrawl({ url: run.startUrl, limit: 25, config,
      environment: 'default', startedAt: run.completedAt })).toBeNull();
  },
);

it('rejects malformed filter names/query while recovering legacy defaults', () => {
  const preset = { id: 'valid', name: 'Valid', severity: 'all', segment: 'all', onlyProblems: false, sort: 'url' };
  localStorage.setItem('seomi_project_contract_crawl_filter_presets_v1', JSON.stringify([
    { ...preset, name: {} }, { ...preset, query: [] }, preset,
  ]));
  expect(loadFilterPresets('contract')).toEqual([{ ...preset, query: '', errorKind: 'all', descending: false }]);
});

it('validates saved keyword tags and nested clustering evidence', () => {
  const keyword = { id: 'fixture', keyword: 'test', search_volume: 0, difficulty: 0, cpc: 0,
    intent: 'Informational', tags: [], addedAt: run.completedAt };
  expect(savedKeywordSchema.safeParse(keyword).success).toBe(true);
  expect(savedKeywordSchema.safeParse({ ...keyword, tags: [null] }).success).toBe(false);
  const clustering = { clusters: [], unclusteredKeywords: [], snapshots: [], minSharedUrls: 3, analyzedAt: run.completedAt };
  expect(keywordClusteringResultSchema.safeParse(clustering).success).toBe(true);
  expect(keywordClusteringResultSchema.safeParse({ ...clustering, clusters: [{ id: 'broken', keywords: 1, pairOverlaps: [] }] }).success).toBe(false);
});
