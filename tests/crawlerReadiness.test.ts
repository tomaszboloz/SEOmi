import { describe, expect, it } from 'vitest';
import type { SiteCrawlResult } from '@/types';
import { buildCrawlerReadiness } from '@/services/crawlerReadiness';
import i18n from '@/i18n';

const baseResult = (overrides: Partial<SiteCrawlResult> = {}): SiteCrawlResult => ({
  start_url: 'https://example.com/',
  crawl_mode: 'http',
  pages_crawled: 2,
  health_score: 90,
  critical_count: 0,
  warning_count: 0,
  notice_count: 0,
  duration_ms: 120,
  cancelled: false,
  robots_txt_status: 'Loaded 0 applicable robots.txt rules',
  robots_blocked_count: 0,
  sitemap_status: 'loaded',
  sitemap_urls_discovered: 0,
  sitemap_urls: [],
  pages: [
    {
      url: 'https://example.com/', final_url: 'https://example.com/', redirect_chain: [], depth: 0, http_status: 200,
      response_time_ms: 30, title: 'Home', meta_description: 'Home', canonical: 'https://example.com/', indexability_status: 'Eligible from this response only',
      body_truncated: false, word_count: 100, semantic_terms: ['home', 'example'], schema_types: ['WebPage'], schema_syntax_errors: 0,
      document_language: 'en', hreflangs: [], h1_count: 1, internal_link_count: 1, external_link_count: 0, links: [], images: [], issues_count: 0, issues: [],
    },
    {
      url: 'https://example.com/about', final_url: 'https://example.com/about', redirect_chain: [], depth: 1, http_status: 200,
      response_time_ms: 40, title: 'About', meta_description: 'About', canonical: 'https://example.com/about', indexability_status: 'Eligible from this response only',
      body_truncated: false, word_count: 80, semantic_terms: ['about', 'example'], schema_types: ['WebPage'], schema_syntax_errors: 0,
      document_language: 'en', hreflangs: [], h1_count: 1, internal_link_count: 0, external_link_count: 0, links: [], images: [], issues_count: 0, issues: [],
    },
  ],
  ...overrides,
});

describe('buildCrawlerReadiness', () => {
  it('returns a passing local report for a complete HTTP snapshot and marks rendering unknown', () => {
    const report = buildCrawlerReadiness(baseResult());
    expect(report.totalPages).toBe(2);
    expect(report.score).not.toBeNull();
    expect(report.checks.find((check) => check.id === 'http-response')?.status).toBe('pass');
    expect(report.checks.find((check) => check.id === 'rendered-dom')?.status).toBe('unknown');
    expect(report.limitations).toContain(i18n.t('crawlerReadiness.limitations.httpSnapshot'));
  });

  it('does not turn blocked pages or truncated content into a false positive', () => {
    const report = buildCrawlerReadiness(baseResult({
      robots_blocked_count: 1,
      pages: [
        {
          ...baseResult().pages[0],
          http_status: 404,
          title: '',
          meta_description: '',
          canonical: undefined,
          indexability_status: 'Blocked by HTTP status',
          body_truncated: true,
          word_count: 0,
          semantic_terms: [],
          schema_types: [],
          schema_syntax_errors: 1,
          document_language: undefined,
        },
      ],
      pages_crawled: 1,
    }));
    expect(report.checks.find((check) => check.id === 'http-response')?.status).toBe('error');
    expect(report.checks.find((check) => check.id === 'indexability')?.status).toBe('error');
    expect(report.checks.find((check) => check.id === 'content')?.status).toBe('error');
    expect(report.checks.find((check) => check.id === 'structured-data')?.status).toBe('error');
    expect(report.score).toBeLessThan(80);
  });

  it('labels a browser-rendered run as executed DOM without claiming bot parity', () => {
    const report = buildCrawlerReadiness(baseResult({ crawl_mode: 'browser-rendered' }));
    const rendered = report.checks.find((check) => check.id === 'rendered-dom');
    expect(rendered?.status).toBe('pass');
    expect(rendered?.evidence).toContain('browser-rendered');
  });

  it('detects schema error findings even when syntax errors count is zero', () => {
    const report = buildCrawlerReadiness(baseResult({
      pages: [
        {
          ...baseResult().pages[0],
          schema_syntax_errors: 0,
          schema_validation_findings: [{ finding: { severity: 'error' } } as any],
        },
      ],
    }));
    expect(report.checks.find((check) => check.id === 'structured-data')?.status).toBe('error');
  });

  it('does not report error pages as missing semantic terms because the crawler skips them', () => {
    const report = buildCrawlerReadiness(baseResult({
      pages: [
        baseResult().pages[0],
        { ...baseResult().pages[1], http_status: 404, semantic_terms: [] },
      ],
    }));
    const semantics = report.checks.find((check) => check.id === 'content-semantics');
    expect(semantics?.status).toBe('pass');
    expect(semantics?.affectedPages).toBe(0);
    expect(semantics?.evidenceParams).toEqual({ withTerms: 1, withoutTerms: 0 });

    const onlyErrors = buildCrawlerReadiness(baseResult({
      pages: baseResult().pages.map((page) => ({ ...page, http_status: 404, semantic_terms: [] })),
    }));
    expect(onlyErrors.checks.find((check) => check.id === 'content-semantics')?.status).toBe('unknown');
  });

  it('does not count stored stopwords as semantic coverage', () => {
    const report = buildCrawlerReadiness(baseResult({
      pages: [{ ...baseResult().pages[0], semantic_terms: ['ale', '2026'] }],
      pages_crawled: 1,
    }));
    const semantics = report.checks.find((check) => check.id === 'content-semantics');
    expect(semantics?.status).toBe('unknown');
    expect(semantics?.evidenceParams).toEqual({ withTerms: 0, withoutTerms: 1 });
  });
});
