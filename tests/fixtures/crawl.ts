import type { CrawledPageSummary, SiteCrawlResult, CrawlRunRecord } from '@/types';
import { DEFAULT_CRAWL_CONFIG } from '@/services/contracts/crawlDefaults';

export const createCrawlPageFixture = (patch: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
  url: 'https://example.test/', final_url: 'https://example.test/', redirect_chain: [], depth: 0,
  http_status: 200, response_time_ms: 0, indexability_status: 'Eligible from this response only', body_truncated: false,
  word_count: 0, schema_types: [], schema_syntax_errors: 0, hreflangs: [], h1_count: 0,
  internal_link_count: 0, external_link_count: 0, links: [], images: [], issues_count: 0, issues: [], ...patch,
});

export const createCrawlResultFixture = (patch: Partial<SiteCrawlResult> = {}): SiteCrawlResult => ({
  start_url: 'https://example.test/', pages_crawled: 0, health_score: 0, critical_count: 0,
  warning_count: 0, notice_count: 0, pages: [], duration_ms: 0, cancelled: false,
  robots_txt_status: 'unavailable', robots_blocked_count: 0, sitemap_status: 'unavailable',
  sitemap_urls_discovered: 0, sitemap_urls: [], ...patch,
});

export const createCrawlRunFixture = (patch: Partial<CrawlRunRecord> = {}): CrawlRunRecord => ({
  id: 'fixture-run', completedAt: '2026-10-01T00:00:00Z', startUrl: 'https://example.test/',
  config: DEFAULT_CRAWL_CONFIG, result: createCrawlResultFixture(), ...patch,
});
