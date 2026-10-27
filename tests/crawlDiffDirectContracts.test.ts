import { describe, expect, it } from 'vitest';
import type { SiteCrawlResult } from '@/types';
import { compareCrawlResults, crawlComparisonKey } from '@/services/crawlDiff';
import i18n from '@/i18n';

const page = (url: string, patch: Partial<SiteCrawlResult['pages'][number]> = {}) => ({
  url, final_url: url, redirect_chain: [], depth: 0, http_status: 200, response_time_ms: 10,
  title: 'Title', meta_description: 'Description', canonical: url, meta_robots: 'index', x_robots_tag: '',
  indexability_status: 'Eligible from this response only', h1_count: 1, word_count: 10, body_truncated: false,
  schema_types: [], schema_syntax_errors: 0, hreflangs: [], internal_link_count: 0, external_link_count: 0,
  links: [], images: [], issues_count: 0, issues: [], ...patch,
});

const result = (pages: SiteCrawlResult['pages']): SiteCrawlResult => ({
  start_url: 'https://example.test/', pages_crawled: pages.length, health_score: 100,
  critical_count: 0, warning_count: 0, notice_count: 0, pages, duration_ms: 10, cancelled: false, timed_out: false,
  robots_txt_status: 'loaded', robots_blocked_count: 0, sitemap_status: 'loaded', sitemap_urls_discovered: 0, sitemap_urls: [],
});

describe('crawl diff direct contracts', () => {
  it('normalizes valid paths and safely falls back for malformed URLs', () => {
    expect(crawlComparisonKey('https://host.test/docs/?gclid=x&b=two words&utm_source=x&a=1', true))
      .toBe('/docs?a=1&b=two%20words');
    expect(crawlComparisonKey('not a URL#fragment', true)).toBe('not a URL');
    expect(crawlComparisonKey('https://host.test/page', false)).toBe('https://host.test/page');
  });

  it('does not report unchanged matched pages and omits matchedUrl for the same URL', () => {
    const unchanged = compareCrawlResults(result([page('https://example.test/a')]), result([page('https://example.test/a')]), { matchByPath: true });
    expect(unchanged).toEqual({ added: [], removed: [], changed: [] });

    const changed = compareCrawlResults(
      result([page('https://example.test/a', { title: 'Current', final_url: 'https://example.test/landing' })]),
      result([page('https://example.test/a', { title: 'Baseline', final_url: 'https://example.test/old' })]),
      { matchByPath: true },
    );
    expect(changed.changed).toEqual([expect.objectContaining({ kind: 'changed', url: 'https://example.test/a', fields: [
      i18n.t('crawlDiff.fields.finalUrl'), i18n.t('crawlDiff.fields.title'),
    ] })]);
    expect(changed.changed[0]).not.toHaveProperty('matchedUrl');
  });

  it('fails closed when path matching would collapse multiple observed URLs', () => {
    const diff = compareCrawlResults(
      result([page('https://www.example.test/docs?a=1'), page('https://www.example.test/docs/?a=1#fragment')]),
      result([page('https://staging.example.test/docs?a=1')]),
      { matchByPath: true },
    );
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
    expect(diff.collisions).toEqual([{ key: '/docs?a=1', side: 'current', urls: [
      'https://www.example.test/docs/?a=1#fragment', 'https://www.example.test/docs?a=1',
    ] }]);
  });

  it('also reports repeated full URLs instead of silently replacing evidence', () => {
    const diff = compareCrawlResults(result([page('https://example.test/a'), page('https://example.test/a')]), result([]));
    expect(diff.collisions).toEqual([{ key: 'https://example.test/a', side: 'current', urls: ['https://example.test/a', 'https://example.test/a'] }]);
    expect(diff.added).toHaveLength(0);
  });
});
