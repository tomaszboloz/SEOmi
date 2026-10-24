import { describe, expect, it } from 'vitest';
import { buildClusters, normalizeCode, normalizeUrl, type HreflangPage } from '@/services/hreflangParity/cluster';
import { compareParity, summarize } from '@/services/hreflangParity/parity';

const tag = (language: string, target_url: string, extra = {}) => ({ language, target_url, ...extra });
const expectedUrl = (host: string, pathname: string): string => new URL(pathname, `https://${host}`).href.replace(/\/$/u, '');
const hasExactUrl = (urls: readonly string[], expected: string): boolean => urls.some((value) => {
  try {
    return new URL(value).href.replace(/\/$/u, '') === expected;
  } catch {
    return false;
  }
});

describe('hreflang clusters', () => {
  it('normalizes urls and codes', () => {
    expect(normalizeUrl('https://a.test/x/#f')).toBe('https://a.test/x');
    expect(normalizeUrl(' not a url ')).toBe('not a url');
    expect(normalizeCode(' en_GB ')).toBe('en-gb');
  });
  it('groups connected pages and reports graph issues', () => {
    const pages: HreflangPage[] = [
      { url: 'https://a.test/en', hreflangs: [tag('en-GB', 'https://a.test/en'), tag('pl', 'https://a.test/pl', { reciprocal_in_run: false, target_checked_in_run: false }), tag('xx_invalid_1', 'https://a.test/zz')] },
      { url: 'https://a.test/pl', hreflangs: [tag('pl', 'https://a.test/pl'), tag('en-gb', 'https://a.test/en/'), tag('x-default', 'https://a.test/en')] },
      { url: 'https://b.test/', hreflangs: [tag('de', 'https://b.test/de')] },
      { url: 'https://c.test/', hreflangs: [] },
    ];
    const clusters = buildClusters(pages);
    expect(clusters).toHaveLength(2);
    const expectedA = expectedUrl('a.test', '/en');
    const a = clusters.find((c) => hasExactUrl(c.urls, expectedA));
    const enUrls = a?.languages.get('en-gb') ?? [];
    expect(enUrls).toEqual([expectedA]);
    const codes = a?.issues.map((i) => i.code) ?? [];
    expect(codes).toEqual(expect.arrayContaining(['missing-x-default', 'invalid-code', 'missing-reciprocal', 'target-not-crawled']));
    const b = clusters.find((c) => hasExactUrl(c.urls, expectedUrl('b.test', '/')));
    expect(b?.issues.map((i) => i.code)).toContain('missing-self');
    expect(b?.issues.map((i) => i.code)).toContain('missing-x-default');
  });
});

describe('parity', () => {
  const cov = (o: Record<string, number>) => new Map(Object.entries(o));
  const coverage = new Map([['pl', cov({ a: 1000, b: 800, c: 500, d: 300 })], ['de', cov({ a: 900, b: 100, c: 0 })]]);
  it('is inconclusive for missing data, partial crawl or one language', () => {
    expect(compareParity({ referenceLanguage: 'pl', coverage: new Map(), complete: true }).gaps).toEqual(expect.arrayContaining(['no-reference-coverage', 'single-language']));
    expect(compareParity({ referenceLanguage: 'pl', coverage, complete: false }).gaps).toEqual(['partial-crawl']);
    expect(compareParity({ referenceLanguage: 'pl', coverage: new Map([['pl', cov({})], ['de', cov({})]]), complete: true }).status).toBe('inconclusive');
  });
  it('classifies covered, shallow, missing and local exceptions', () => {
    const report = compareParity({ referenceLanguage: 'pl', coverage, complete: true, localExceptions: new Map([['de', new Set(['d'])]]) });
    expect(report.status).toBe('ready');
    expect(report.rows.map((r) => r.status)).toEqual(['covered', 'shallow', 'missing', 'intentionally-local']);
    expect(summarize(report)).toEqual({ covered: 1, shallow: 1, missing: 1, 'intentionally-local': 1 });
    const strict = compareParity({ referenceLanguage: 'pl', coverage, complete: true, shallowRatio: 0.95 });
    expect(strict.rows[0].status).toBe('shallow');
  });
});
