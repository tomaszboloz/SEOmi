import { describe, expect, it } from 'vitest';
import {
  CrawlConfigSchema,
  CrawledPageSummarySchema,
  SiteCrawlResultSchema,
  CrawlRunRecordSchema,
  CustomSearchDefinitionSchema,
} from '@/services/contracts/crawl';

import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

describe('crawl contracts modular architecture', () => {
  it('keeps crawl contract facade and all submodules below 150 lines', () => {
    const files = [
      'src/services/contracts/crawl.ts',
      ...codeFiles('src/services/contracts/crawl'),
    ];
    expect(files.length).toBe(7);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('validates minimal CrawlConfigSchema', () => {
    const parsed = CrawlConfigSchema.safeParse({
      includePatterns: [],
      excludePatterns: [],
      allowSubdomains: false,
      keepQueryStrings: true,
      respectRobots: true,
      respectCrawlDelay: true,
      discoverSitemaps: true,
      followNofollow: false,
    });
    expect(parsed.success).toBe(true);
  });

  it('validates minimal CrawledPageSummarySchema', () => {
    const parsed = CrawledPageSummarySchema.safeParse({
      url: 'https://example.com',
      final_url: 'https://example.com',
      redirect_chain: [],
      depth: 0,
      http_status: 200,
      response_time_ms: 100,
      indexability_status: 'indexable',
      body_truncated: false,
      word_count: 50,
      schema_types: [],
      schema_syntax_errors: 0,
      hreflangs: [],
      h1_count: 1,
      internal_link_count: 0,
      external_link_count: 0,
      links: [],
      images: [],
      issues_count: 0,
      issues: [],
    });
    expect(parsed.success).toBe(true);
  });

  it('validates minimal SiteCrawlResultSchema and CrawlRunRecordSchema', () => {
    const result = {
      start_url: 'https://example.com',
      pages_crawled: 1,
      health_score: 100,
      critical_count: 0,
      warning_count: 0,
      notice_count: 0,
      pages: [],
      duration_ms: 100,
      cancelled: false,
      robots_txt_status: 'ok',
      robots_blocked_count: 0,
      sitemap_status: 'ok',
      sitemap_urls_discovered: 0,
      sitemap_urls: [],
    };
    expect(SiteCrawlResultSchema.safeParse(result).success).toBe(true);

    const run = {
      id: 'run-1',
      completedAt: '2026-01-01',
      startUrl: 'https://example.com',
      config: {
        includePatterns: [],
        excludePatterns: [],
        allowSubdomains: false,
        keepQueryStrings: true,
        respectRobots: true,
        respectCrawlDelay: true,
        discoverSitemaps: true,
        followNofollow: false,
      },
      result,
    };
    expect(CrawlRunRecordSchema.safeParse(run).success).toBe(true);
  });

  it('validates CustomSearchDefinitionSchema with nullable and present attribute', () => {
    const withNull = CustomSearchDefinitionSchema.parse({
      id: 'search-1',
      name: 'Search 1',
      selectorType: 'css',
      query: 'a.link',
      resultType: 'attribute',
      attribute: null,
    });
    expect(withNull.attribute).toBeUndefined();

    const withAttr = CustomSearchDefinitionSchema.parse({
      id: 'search-2',
      name: 'Search 2',
      selectorType: 'xpath',
      query: '//a',
      resultType: 'attribute',
      attribute: 'href',
    });
    expect(withAttr.attribute).toBe('href');
  });
});
