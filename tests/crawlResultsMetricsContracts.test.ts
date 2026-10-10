import { describe, expect, it } from 'vitest';
import {
  buildHistoryMetrics,
  calculateTabCounts,
} from '@/components/Domain/crawlResults/session/crawlResultsMetrics';
import type { CrawlRunRecord, CrawledPageSummary, SiteCrawlResult } from '@/types';

const page = (overrides: Partial<CrawledPageSummary> = {}): CrawledPageSummary => ({
  url: 'https://example.test/page',
  final_url: 'https://example.test/page',
  redirect_chain: [],
  depth: 0,
  http_status: 200,
  response_time_ms: 100,
  indexability_status: 'Eligible from this response only',
  body_truncated: false,
  word_count: 0,
  schema_types: [],
  schema_syntax_errors: 0,
  hreflangs: [],
  h1_count: 0,
  internal_link_count: 0,
  external_link_count: 0,
  links: [],
  images: [],
  issues_count: 0,
  issues: [],
  ...overrides,
});

const result = (pages: CrawledPageSummary[], pagesCrawled = pages.length): SiteCrawlResult => ({
  start_url: 'https://example.test',
  crawl_mode: 'http',
  pages_crawled: pagesCrawled,
  health_score: 88,
  critical_count: 2,
  warning_count: 3,
  notice_count: 1,
  duration_ms: 250,
  cancelled: false,
  pages,
  robots_txt_status: 'available',
  robots_blocked_count: 0,
  sitemap_status: 'available',
  sitemap_urls_discovered: 0,
  sitemap_urls: [],
});

const run = (crawlResult: SiteCrawlResult, id = 'run-1'): CrawlRunRecord => ({
  id,
  completedAt: '2026-10-01T00:00:00.000Z',
  startUrl: crawlResult.start_url,
  config: {} as CrawlRunRecord['config'],
  result: crawlResult,
});

describe('crawl results metric contracts', () => {
  it('calculates every tab count from page evidence and optional arrays', () => {
    const pages = [
      page({
        issues: [{}, {}] as any,
        content_hash: 'hash-1',
        title: 'Page title',
        custom_search_results: [{ values: [{}, {}] }, { values: [{}] }] as any,
        links: [{}, {}] as any,
        images: [{}, {}] as any,
        frames: [{}] as any,
        favicons: ['icon'],
        document_language: 'en',
        schema_types: ['Article'],
        html_validation_findings: [{}, {}] as any,
        response_time_ms: 120,
        http_status: 200,
        word_count: 100,
      }),
      page({
        issues: [{}] as any,
        links: [{}] as any,
        images: [{}] as any,
        schema_syntax_errors: 1,
        response_time_ms: Number.NaN,
        http_status: 404,
        indexability_status: 'Blocked by robots',
        word_count: 50,
      }),
      page({
        meta_description: 'Description',
        hreflangs: [{}] as any,
        favicon_metadata: [{}] as any,
        amp_url: 'https://example.test/amp',
        response_time_ms: null as any,
        http_status: 201,
        word_count: 25,
      }),
    ];
    const crawlResult = result(pages, 9);
    crawlResult.resources = [{}, {}] as any;

    expect(calculateTabCounts(
      crawlResult,
      { metadataRows: [{ facets: [] }, { facets: ['missing-title'] }, { facets: ['missing-description'] }] },
      run(crawlResult),
    )).toEqual({
      overview: 9,
      crawlerReadiness: 3,
      urls: 3,
      issues: 3,
      content: 2,
      metadata: 2,
      customSearch: 3,
      links: 3,
      media: 5,
      frames: 1,
      social: 2,
      directives: 3,
      international: 2,
      structured: 2,
      validation: 2,
      performance: 1,
      visualisations: 3,
      exports: 9,
    });

    expect(calculateTabCounts(crawlResult, { metadataRows: [] }, undefined).exports).toBe(0);
  });

  it('builds six translated history series in the supplied chronological order', () => {
    const first = result([
      page({ http_status: 200, word_count: 10 }),
      page({ http_status: 500, word_count: 20, indexability_status: 'Blocked by robots' }),
    ], 2);
    const second = result([
      page({ http_status: 204, word_count: Number.NaN as any }),
    ], 4);
    second.critical_count = Number.POSITIVE_INFINITY;
    second.warning_count = Number.NaN;
    second.pages_crawled = Number.NaN;

    expect(buildHistoryMetrics([run(first, 'old'), run(second, 'new')], (key) => `translated:${key}`)).toEqual([
      { label: 'translated:crawl.ui.processedUrls', values: [2, null], colour: 'text-emerald-300' },
      { label: 'translated:crawl.ui.criticalIssues', values: [2, null], colour: 'text-rose-300' },
      { label: 'translated:crawl.ui.warnings', values: [3, null], colour: 'text-amber-300' },
      { label: 'translated:crawl.ui.successStatuses', values: [1, 1], colour: 'text-sky-300' },
      { label: 'translated:crawl.ui.indexable', values: [1, 1], colour: 'text-violet-300' },
      { label: 'translated:crawl.ui.contentWords', values: [30, null], colour: 'text-cyan-300' },
    ]);
  });
});
