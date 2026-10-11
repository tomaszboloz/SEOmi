import { describe, expect, it } from 'vitest';
import { joinGa4Evidence } from '@/services/ga4/join';
import type { GscPerformanceData, SiteCrawlResult } from '@/types';
import type { Ga4Report } from '@/types/ga4';

const report: Ga4Report = { property: 'properties/123', start_date: '2026-09-01', end_date: '2026-09-30', may_be_truncated: false, row_count: 3, rows: [
  { host_name: 'site.test', landing_page: '/home?utm=a', sessions: 4, engaged_sessions: 3, key_events: 1 },
  { host_name: 'site.test', landing_page: '/home?utm=b', sessions: 2, engaged_sessions: 1, key_events: 0 },
  { host_name: 'evil.test', landing_page: 'https://evil.test/home', sessions: 8, engaged_sessions: 8, key_events: 2 },
] };
const gsc = (page: string, start = report.start_date, end = report.end_date): GscPerformanceData => ({ site_url: 'https://site.test/', start_date: start, end_date: end, total_clicks: 1, total_impressions: 2, avg_ctr: 0.5, avg_position: 2, queries: [], pages: [{ page, clicks: 7, impressions: 20, ctr: 0.35, position: 3 }], daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 100 });
const crawl = (): SiteCrawlResult => ({ start_url: 'https://site.test/', pages_crawled: 1, health_score: 100, critical_count: 0, warning_count: 0, notice_count: 0, pages: [{ url: 'https://site.test/home?utm=a', final_url: 'https://site.test/home?utm=a', redirect_chain: [], depth: 0, http_status: 200, response_time_ms: 10, body_truncated: false, word_count: 3, schema_types: [], schema_syntax_errors: 0, hreflangs: [], indexability_status: 'indexable', h1_count: 1, internal_link_count: 0, external_link_count: 0, links: [], images: [], issues_count: 2, issues: [] }], duration_ms: 1, cancelled: false, robots_txt_status: 'loaded', robots_blocked_count: 0, sitemap_status: 'loaded', sitemap_urls_discovered: 0, sitemap_urls: [] });

describe('GA4 evidence joins', () => {
  it('joins exact query strings and same-origin crawl evidence', () => {
    const result = joinGa4Evidence({ report, gscData: gsc('https://site.test/home?utm=a'), crawlResult: crawl(), projectRootUrl: 'https://site.test/' });
    expect(result.matched_gsc_rows).toBe(1);
    expect(result.matched_crawl_rows).toBe(1);
    expect(result.rows[0]).toMatchObject({ gsc: { clicks: 7 }, crawl_issue_count: 2 });
    expect(result.rows[1].gsc).toBeUndefined();
    expect(result.rows[2].gsc).toBeUndefined();
  });

  it('omits GSC values when periods differ instead of inventing zeros', () => {
    const result = joinGa4Evidence({ report, gscData: gsc('https://site.test/home?utm=a', '2026-08-01'), projectRootUrl: 'https://site.test/' });
    expect(result.gsc_period_matches).toBe(false);
    expect(result.rows[0].gsc).toBeUndefined();
    expect(result.warnings).toContain('Google Search Console and Google Analytics periods differ.');
  });

  it('rejects cross-protocol and lookalike pages', () => {
    const result = joinGa4Evidence({ report: { ...report, rows: [report.rows[0]] }, gscData: gsc('http://site.test/home?utm=a'), projectRootUrl: 'https://site.test/' });
    expect(result.matched_gsc_rows).toBe(0);
    expect(result.rows[0].gsc).toBeUndefined();
  });
});
