import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { appLocale } from '@/services/localeFormat';
import { assertFreeFeedRequest, normalizeFreeRequest } from '@/services/freeSerp/contracts';
import { assertPublicFeedKind, assertPublicFeedUrl, googleSuggestionsFeedUrl, googleTrendsFeedUrl, publicFeedUrl } from '@/services/freeSerp/urls';
import { auditHtml } from '@/services/export/html';
import { auditTableFilename, crawlFilename, reportFilename } from '@/services/export/filenames';
import { csv, escapeCsv, exportHeaders, spreadsheetSafe } from '@/services/export/csv';

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('free feeds, locale and export helpers', () => {
  it('canonicalizes Google suggestions and validates the exact URL context', () => {
    const request = { feed: 'google-suggestions' as const, geo: ' pl ', keyword: 'seo audit', language: 'PL-pl' };
    expect(normalizeFreeRequest(request)).toEqual({ feed: 'google-suggestions', geo: 'PL', keyword: 'seo audit', language: 'pl-pl' });
    const expected = googleSuggestionsFeedUrl('seo audit', 'PL', 'pl-pl');
    expect(publicFeedUrl(request)).toBe(expected);
    expect(() => assertPublicFeedUrl(expected, request)).not.toThrow();
    expect(googleTrendsFeedUrl('de')).toContain('geo=DE');
    expect(assertPublicFeedKind('google-suggestions')).toBe(true);
    expect(assertPublicFeedKind('invalid')).toBe(false);
    expect(() => assertFreeFeedRequest({ ...request, keyword: ' ' })).toThrow(/keyword/);
    expect(() => assertPublicFeedUrl(`${expected}&extra=1`, request)).toThrow(/whitelist/);
  });

  it('formats numbers using the active application language', async () => {
    await i18n.changeLanguage('de');
    expect(appLocale()).toBe('de');
    expect((2048).toLocaleString(appLocale())).toBe('2.048');
    await i18n.changeLanguage('pt_BR');
    expect(appLocale()).toBe('pt-BR');
  });

  it('escapes spreadsheet formulas and produces stable filenames and HTML', () => {
    expect(spreadsheetSafe('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsv('a"b')).toBe('"a""b"');
    expect(csv([['name', '=formula'], ['x', null]])).toBe('"name","\'=formula"\r\n"x",""');
    expect(exportHeaders('audit')).toBeInstanceOf(Array);
    const audit = {
      url: 'https://example.test/request', final_url: 'https://example.test/final', timestamp: '2026-10-23T12:34:56Z',
      http_status: 200, response_time_ms: 42, health_score: 88, issues: [],
      meta_tags: { title: 'Title', description: 'Desc', canonical: 'https://example.test/final' },
      headings: { h1_count: 1 }, images: [], links: { total_links: 0 }, security_headers: { score: 100 }, redirect_chain: [],
    } as never;
    const html = auditHtml(audit);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('https://example.test/final');
    expect(reportFilename(audit, 'html')).toBe('seomi-audit-example.test-2026-10-23.html');
    expect(auditTableFilename(audit, 'links')).toContain('-links.csv');
    expect(crawlFilename({ id: 'run-1', startUrl: 'not-a-url', completedAt: '', result: {} } as never, 'report', 'json')).toBe('seomi-crawl-crawl-run1-report.json');
  });
});
