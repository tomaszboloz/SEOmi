import { describe, expect, it } from 'vitest';
import { SiteCrawlResultSchema, CrawlRunRecordSchema } from '@/services/contracts/crawl/crawlResult';

describe('crawlResultContractsDeep', () => {
  const baseResult = {
    start_url: 'https://example.com',
    pages_crawled: 5,
    health_score: 95,
    critical_count: 0,
    warning_count: 1,
    notice_count: 2,
    pages: [],
    duration_ms: 1250,
    cancelled: false,
    robots_txt_status: 'ok',
    robots_blocked_count: 0,
    sitemap_status: 'ok',
    sitemap_urls_discovered: 10,
    sitemap_urls: ['https://example.com/p1'],
  };

  it('validates minimal valid SiteCrawlResult and transforms nullable fields', () => {
    const parsed = SiteCrawlResultSchema.parse({
      ...baseResult,
      crawl_mode: null,
      score_version: null,
      timed_out: null,
      robots_user_agent: null,
    });
    expect(parsed.start_url).toBe('https://example.com');
    expect(parsed.crawl_mode).toBeUndefined();
    expect(parsed.score_version).toBeUndefined();
    expect(parsed.timed_out).toBeUndefined();
    expect(parsed.robots_user_agent).toBeUndefined();
  });

  it('validates crawl modes and full robots properties', () => {
    const parsed = SiteCrawlResultSchema.parse({
      ...baseResult,
      crawl_mode: 'browser-rendered',
      score_version: 2,
      timed_out: true,
      robots_txt_evaluation_status: 'evaluated',
      robots_txt_status_code: 200,
      robots_txt_final_url: 'https://example.com/robots.txt',
      robots_txt_redirect_chain: [
        { from_url: 'http://example.com/robots.txt', http_status: 301, to_url: 'https://example.com/robots.txt' },
      ],
      robots_applicable_rules: [{ directive: 'Disallow', path: '/admin' }],
      robots_agent_matrix: [
        { user_agent: 'Googlebot', specific_group: true, applicable_rules: [{ directive: 'Allow', path: '/' }] },
      ],
      robots_sitemap_directives: ['https://example.com/sitemap.xml'],
      rejected_urls: [{ url: 'https://example.com/blocked', reason: 'robots_txt' }],
      storage_pages_truncated: true,
      storage_pages_total: 100,
      limit_reasons: ['max_pages'],
    });
    expect(parsed.crawl_mode).toBe('browser-rendered');
    expect(parsed.score_version).toBe(2);
    expect(parsed.storage_pages_truncated).toBe(true);
    expect(parsed.limit_reasons).toEqual(['max_pages']);
  });

  it('rejects invalid or missing required fields in SiteCrawlResultSchema', () => {
    expect(() => SiteCrawlResultSchema.parse({})).toThrow();
    expect(() => SiteCrawlResultSchema.parse({ ...baseResult, start_url: 123 })).toThrow();
    expect(() => SiteCrawlResultSchema.parse({ ...baseResult, pages_crawled: 'ten' })).toThrow();
    expect(() => SiteCrawlResultSchema.parse({ ...baseResult, crawl_mode: 'unsupported' })).toThrow();
    expect(() => SiteCrawlResultSchema.parse({ ...baseResult, robots_txt_status_code: 99 })).toThrow();
  });

  it('validates CrawlRunRecordSchema environments and storage compaction', () => {
    const config = {
      includePatterns: [],
      excludePatterns: [],
      allowSubdomains: false,
      keepQueryStrings: true,
      respectRobots: true,
      respectCrawlDelay: false,
      discoverSitemaps: true,
      followNofollow: false,
    };

    const record = CrawlRunRecordSchema.parse({
      id: 'run-123',
      projectId: 'proj-456',
      completedAt: '2026-10-11T12:00:00Z',
      startUrl: 'https://example.com',
      config,
      result: baseResult,
      environment: 'staging',
      storage_compacted: true,
    });
    expect(record.id).toBe('run-123');
    expect(record.environment).toBe('staging');
    expect(record.storage_compacted).toBe(true);

    const recordNullEnv = CrawlRunRecordSchema.parse({
      id: 'run-124',
      completedAt: '2026-10-11T12:00:00Z',
      startUrl: 'https://example.com',
      config,
      result: baseResult,
      environment: null,
    });
    expect(recordNullEnv.environment).toBeUndefined();
  });

  it('rejects invalid environment in CrawlRunRecordSchema', () => {
    const config = {
      includePatterns: [],
      excludePatterns: [],
      allowSubdomains: false,
      keepQueryStrings: true,
      respectRobots: true,
      respectCrawlDelay: false,
      discoverSitemaps: true,
      followNofollow: false,
    };
    expect(() => CrawlRunRecordSchema.parse({
      id: 'run-125',
      completedAt: '2026-10-11T12:00:00Z',
      startUrl: 'https://example.com',
      config,
      result: baseResult,
      environment: 'invalid-env',
    })).toThrow();
  });
});
