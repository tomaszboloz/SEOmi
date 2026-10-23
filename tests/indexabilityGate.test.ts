import { describe, expect, it } from 'vitest';
import { applyGate, canonicalTarget, classifyIndexability, detectConflicts, exclusionOf, hasNoindex, type GatePage } from '@/services/indexabilityGate';
import { applyIndexabilityGate, gateSkippedCount } from '@/services/siteFocus/gate';
import { buildSiteFocusReport, type FocusPage } from '@/services/siteFocus';

const page = (over: Partial<GatePage> = {}): GatePage => ({ url: 'https://a.com/p', final_url: 'https://a.com/p', http_status: 200, ...over });

describe('classifyIndexability', () => {
  it('detects each state', () => {
    expect(classifyIndexability(page({ http_status: 404 }))).toBe('error-status');
    expect(classifyIndexability(page({ meta_robots: 'NOINDEX, follow' }))).toBe('noindex');
    expect(classifyIndexability(page({ x_robots_tag: 'none' }))).toBe('noindex');
    expect(classifyIndexability(page({ robots_decision: { indexability: 'noindex', link_following: 'follow', response_headers_available: true } }))).toBe('noindex');
    expect(classifyIndexability(page({ indexability_verdict: { status: 'blocked', reasons: [] } }))).toBe('noindex');
    expect(classifyIndexability(page({ canonical: 'https://b.com/x' }))).toBe('canonicalized');
    expect(classifyIndexability(page({ canonical_targets: [{ url: '/other', relation: 'x', checked_in_run: true }] }))).toBe('canonicalized');
    expect(classifyIndexability(page({ canonical: 'https://a.com/p/' }))).toBe('indexable');
    expect(classifyIndexability(page({ canonical: '  ' }))).toBe('indexable');
    expect(classifyIndexability(page({ http_status: 0 }))).toBe('unknown');
    expect(classifyIndexability(page({ http_status: 0, indexability_verdict: { status: 'uncertain', reasons: [] } }))).toBe('indexable');
  });
  it('helpers', () => {
    expect(hasNoindex(page())).toBe(false);
    expect(canonicalTarget(page({ canonical: 'http://[bad' }))).toBeNull();
    expect(exclusionOf(page({ meta_robots: 'noindex' }))).toBe('noindex');
    expect(exclusionOf(page({ http_status: 500 }))).toBeUndefined();
  });
});

describe('applyGate', () => {
  const pages = [page(), page({ url: 'https://a.com/n', meta_robots: 'noindex' }), page({ url: 'https://a.com/c', canonical: 'https://z.com/' }), page({ url: 'https://a.com/e', http_status: 500 })];
  it('excludes and counts, with opt-in', () => {
    const r = applyGate(pages);
    expect(r.pages).toHaveLength(1);
    expect(r.summary).toMatchObject({ total: 4, skipped: 3, byState: { noindex: 1, canonicalized: 1, 'error-status': 1 }, includeExcluded: false });
    expect(applyGate(pages, { includeExcluded: true }).summary).toMatchObject({ skipped: 0, includeExcluded: true });
  });
});

describe('conflicts', () => {
  const pages = [
    page({ url: 'https://a.com/pillar', meta_robots: 'noindex' }),
    page({ url: 'https://a.com/hub', canonical: 'https://other.com/' }),
    page({ url: 'https://a.com/same', canonical: 'https://a.com/main' }),
  ];
  it('finds all four kinds and treats unknown as no evidence', () => {
    const r = detectConflicts({
      pages, pillarUrls: ['https://a.com/pillar/'], sitemapUrls: ['https://a.com/pillar'], clicks: new Map([['https://a.com/pillar', 3]]),
      inlinkCounts: new Map([['https://a.com/hub', 60], ['https://a.com/same', 99]]),
    });
    expect(r.map((c) => c.code).sort()).toEqual(['inlinked-foreign-canonical', 'noindex-with-traffic', 'pillar-noindex', 'sitemap-noindex']);
    expect(detectConflicts({ pages })).toEqual([]);
    expect(detectConflicts({ pages, referringDomains: new Map([['https://a.com/pillar', 2]]) })).toHaveLength(1);
  });
});

describe('SFS integration', () => {
  const html = (url: string, extra: Partial<FocusPage> = {}): FocusPage => ({
    url, final_url: url, http_status: 200, content_type: 'text/html', word_count: 300, links: [], headings: [], semantic_terms: ['insulin', 'pump', 'diabetes'], ...extra,
  } as unknown as FocusPage);
  const pages = [html('https://a.com/'), html('https://a.com/x'), html('https://a.com/n', { meta_robots: 'noindex' }), html('https://a.com/c', { canonical: 'https://b.com/' })];
  it('skips gated pages by default and includes on request', () => {
    const report = buildSiteFocusReport(pages, 'https://a.com/');
    expect(report.pages.filter((p) => p.skipped === 'noindex')).toHaveLength(1);
    expect(gateSkippedCount(report.pages)).toBe(2);
    const all = buildSiteFocusReport(pages, 'https://a.com/', { includeNonIndexable: true });
    expect(gateSkippedCount(all.pages)).toBe(0);
  });
  it('applyIndexabilityGate keeps earlier skips', () => {
    const items = [{ page: html('https://a.com/n', { meta_robots: 'noindex' }), terms: {} as never, skipped: 'no-content' as const }];
    expect(applyIndexabilityGate(items)[0].skipped).toBe('no-content');
    expect(applyIndexabilityGate(items, true)).toBe(items);
  });
});
