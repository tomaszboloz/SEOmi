import { describe, expect, it, vi } from 'vitest';
import type { GscPerformanceData, SiteCrawlResult } from '@/types';
import { joinGa4Evidence } from '@/services/ga4/join';
import type { Ga4Report, Ga4ReportRow } from '@/types/ga4';

const START = '2026-09-01';
const END = '2026-09-30';
const row = (landing_page = '/home?utm=a', host_name = 'site.test', extra: Record<string, unknown> = {}): Ga4ReportRow => ({ host_name, landing_page, sessions: 0, engaged_sessions: 0, key_events: 0, ...extra } as Ga4ReportRow);
const report = (rows: Ga4ReportRow[] = [row()]): Ga4Report => ({ property: 'properties/123', start_date: START, end_date: END, rows, may_be_truncated: false, row_count: rows.length });
const gsc = (pages: GscPerformanceData['pages'], start_date = START, end_date = END): GscPerformanceData => ({ site_url: 'https://site.test/', start_date, end_date, total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0, queries: [], pages, daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 100 });
const gscPage = (page: string, values: Partial<GscPerformanceData['pages'][number]> = {}): GscPerformanceData['pages'][number] => ({ page, clicks: 0, impressions: 0, ctr: 0, position: 0, ...values });
const crawlPage = (url: string, issues_count = 0): SiteCrawlResult['pages'][number] => ({ url, final_url: url, redirect_chain: [], depth: 0, http_status: 200, response_time_ms: 1, body_truncated: false, word_count: 1, schema_types: [], schema_syntax_errors: 0, hreflangs: [], indexability_status: 'indexable', h1_count: 1, internal_link_count: 0, external_link_count: 0, links: [], images: [], issues_count, issues: [] });
const crawl = (pages: SiteCrawlResult['pages']): SiteCrawlResult => ({ start_url: 'https://site.test/', pages_crawled: pages.length, health_score: 100, critical_count: 0, warning_count: 0, notice_count: 0, pages, duration_ms: 1, cancelled: false, robots_txt_status: 'loaded', robots_blocked_count: 0, sitemap_status: 'loaded', sitemap_urls_discovered: 0, sitemap_urls: [] });

describe('GA4 join boundary branches', () => {
  it('keeps rows unchanged and warns for every invalid project scope', () => {
    for (const projectRootUrl of [undefined, '', '   ', 'not a url', 'ftp://site.test/', 'https://user:pass@site.test/', 'https:///']) {
      const result = joinGa4Evidence({ report: report([row()]), projectRootUrl });
      expect(result.rows[0]).toEqual(row());
      expect(result.warnings).toContain('Project root URL is missing or invalid.');
    }
    const noGsc = joinGa4Evidence({ report: report(), projectRootUrl: 'https://site.test/' });
    expect(noGsc.gsc_period_matches).toBe(false);
    expect(noGsc.warnings).toEqual([]);
  });

  it('joins zero metrics, keeps the first duplicate and rejects invalid URL or metric rows', () => {
    const pages = [
      gscPage('https://site.test/home?utm=a'),
      gscPage('https://site.test/home?utm=a', { clicks: 8 }),
      gscPage('https://site.test/bad-clicks', { clicks: NaN }),
      gscPage('https://site.test/bad-impressions', { impressions: Infinity }),
      gscPage('https://site.test/bad-ctr', { ctr: NaN }),
      gscPage('https://site.test/bad-position', { position: Infinity }),
      gscPage('https://site.test/'), gscPage('https://site.test////'),
      gscPage('https://other.test/home'), gscPage('http://site.test/home'),
      gscPage('https://site.test:8443/home'), gscPage('http://[bad'),
    ];
    const result = joinGa4Evidence({ report: report([row('/home?utm=a'), row('/home?utm=b'), row('/')]), gscData: gsc(pages), projectRootUrl: 'https://site.test/' });
    expect(result.matched_gsc_rows).toBe(2);
    expect(result.rows[0].gsc).toEqual({ clicks: 0, impressions: 0, ctr: 0, position: 0 });
    expect(result.rows[1].gsc).toBeUndefined();
    expect(result.rows[2].gsc).toEqual({ clicks: 0, impressions: 0, ctr: 0, position: 0 });
    const invalidLanding = joinGa4Evidence({ report: report([row('http://[bad')]), gscData: gsc([]), projectRootUrl: 'https://site.test/' });
    expect(invalidLanding.rows[0].gsc).toBeUndefined();
    const port = joinGa4Evidence({ report: report([row('https://site.test:8443/')]), gscData: gsc([gscPage('https://site.test:8443/')]), projectRootUrl: 'https://site.test:8443/' });
    expect(port.matched_gsc_rows).toBe(1);
  });

  it('joins zero crawl issues, keeps the first duplicate and rejects negative or foreign pages', () => {
    const pages = [
      crawlPage('https://site.test/home?utm=a', 0), crawlPage('https://site.test/home?utm=a', 4),
      crawlPage('https://site.test/negative', -1), crawlPage('https://site.test/nonfinite', NaN),
      crawlPage('https://other.test/home'), crawlPage('http://site.test/home'),
      crawlPage('https://site.test:8443/home'), crawlPage('http://[bad'),
    ];
    const first = row('/home?utm=a', 'site.test.', { unknown_metric: 7 });
    const result = joinGa4Evidence({ report: report([first, row('/negative')]), crawlResult: crawl(pages), projectRootUrl: 'https://site.test/' });
    expect(result.matched_crawl_rows).toBe(1);
    expect(result.rows[0]).toMatchObject({ unknown_metric: 7, crawl_issue_count: 0 });
    expect(result.rows[1].crawl_issue_count).toBeUndefined();
  });

  it('does not join GSC rows from a different period and preserves query boundaries', () => {
    const result = joinGa4Evidence({ report: report([row('/home?utm=a')]), gscData: gsc([gscPage('https://site.test/home?utm=a')], '2026-08-01'), projectRootUrl: 'https://site.test/shop/' });
    expect(result.gsc_period_matches).toBe(false);
    expect(result.rows[0].gsc).toBeUndefined();
    expect(result.warnings).toContain('Google Search Console and Google Analytics periods differ.');
  });

  it('keeps URL pathname fallbacks covered for nonstandard URL implementations', () => {
    const NativeURL = URL;
    class EmptyPathURL extends NativeURL { get pathname() { return ''; } }
    vi.stubGlobal('URL', EmptyPathURL);
    try {
      const result = joinGa4Evidence({ report: report([row('/')]), gscData: gsc([gscPage('https://site.test/')]), projectRootUrl: 'https://site.test/' });
      expect(result.matched_gsc_rows).toBe(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
