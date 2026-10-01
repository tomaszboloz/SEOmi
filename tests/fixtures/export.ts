import type { CrawlRunRecord, PageAuditData } from '@/types';

export const audit = { final_url: 'https://example.com', timestamp: '2026-09-20T12:00:00Z', http_status: 200, response_time_ms: 120, health_score: 88, meta_tags: { title: '=unsafe', description: 'Description', canonical: 'https://example.com' }, headings: { h1_count: 1 }, images: [], links: { total_links: 4 }, security_headers: { score: 90 }, issues: [{ severity: 'Warning', category: 'Technical', message: 'Needs "quotes"', recommendation: 'Fix it' }] } as unknown as PageAuditData;

export const crawlRun = {
  id: 'run-unsafe', completedAt: '2026-09-21T09:00:00.000Z', startUrl: 'https://example.com/',
  config: { includePatterns: ['=unsafe'], excludePatterns: [], allowSubdomains: false, scopePath: '/docs', keepQueryStrings: false, respectRobots: true, respectCrawlDelay: true, discoverSitemaps: true, maxRedirects: 10, followNofollow: false },
  result: {
    start_url: 'https://example.com/', pages_crawled: 1, health_score: 80, critical_count: 1, warning_count: 0, notice_count: 0, duration_ms: 12, cancelled: false, timed_out: false, robots_txt_status: 'loaded', robots_blocked_count: 0, sitemap_status: 'loaded', sitemap_urls_discovered: 0, sitemap_urls: [],
    pages: [{ url: '=page', final_url: '+final', redirect_chain: [], depth: 0, http_status: 200, response_time_ms: 10, title: '@title', indexability_status: 'Eligible', body_truncated: false, word_count: 10, schema_types: [], schema_syntax_errors: 0, hreflangs: [], h1_count: 1, internal_link_count: 1, external_link_count: 0, links: [{ target_url: '-link', anchor_text: '=anchor', is_internal: true }], images: [{ src: '@image', alt: '+alt', lazy_loaded: false }], issues_count: 1, issues: [{ severity: 'Warning', message: '=issue' }] }],
  },
} as CrawlRunRecord;

export const crawlRunWithResources = {
  ...crawlRun,
  result: {
    ...crawlRun.result,
    resources: [{ source_urls: ['https://example.com/'], url: '=resource.css', resource_type: 'stylesheet', http_status: 200, content_type: 'text/css', content_length: 42, response_time_ms: 17 }],
  },
} as CrawlRunRecord;
