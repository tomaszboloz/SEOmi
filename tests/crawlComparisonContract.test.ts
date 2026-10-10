import { describe, expect, it } from 'vitest';
import type { CrawlConfig, SiteCrawlResult } from '@/types';
import { compareCrawlRuns, crawlComparisonKey, type CrawlDiffReport } from '@/services/crawlDiff';
import { assessCrawlRun, crawlConfigFingerprint, crawlConfigSignature, crawlScopeFingerprint, crawlScopeSignature, guardCrawlComparison, type CrawlComparisonRun } from '@/services/crawlComparisonContract';
const config = (patch: Partial<CrawlConfig> = {}): CrawlConfig => ({
  includePatterns: [], excludePatterns: [], allowSubdomains: false, scopePath: '/', keepQueryStrings: false,
  respectRobots: true, respectCrawlDelay: true, discoverSitemaps: true, followNofollow: false, maxPages: 10,
  maxDepth: 5, ...patch,
});

const page = (url: string) => ({
  url, final_url: url, redirect_chain: [], depth: 0, http_status: 200, response_time_ms: 10,
  title: 'Title', meta_description: 'Description', canonical: url, meta_robots: 'index', x_robots_tag: '',
  indexability_status: 'Eligible from this response only', h1_count: 1, word_count: 10, body_truncated: false,
  schema_types: [], schema_syntax_errors: 0, hreflangs: [], internal_link_count: 0, external_link_count: 0,
  links: [], images: [], issues_count: 0, issues: [],
} as SiteCrawlResult['pages'][number]);
const run = (id: string, patch: Partial<CrawlComparisonRun> = {}): CrawlComparisonRun => ({
  id, projectId: 'project-a', completedAt: '2026-10-06T10:00:00.000Z', startUrl: 'https://site.test/',
  config: config(), result: {
    start_url: 'https://site.test/', crawl_mode: 'http', pages_crawled: 1, health_score: 100,
    critical_count: 0, warning_count: 0, notice_count: 0, pages: [page('https://site.test/a')], duration_ms: 10,
    cancelled: false, timed_out: false, robots_txt_status: 'loaded', robots_blocked_count: 0,
    sitemap_status: 'loaded', sitemap_urls_discovered: 0, sitemap_urls: [],
  }, environment: 'default', ...patch,
});
describe('crawl comparison contract', () => {
  it('emits complete provenance and treats removed pages as not observed', () => {
    const current = run('current', { completedAt: '2026-10-07T10:00:00.000Z' });
    const baseline = run('baseline', { result: { ...run('x').result, pages: [page('https://site.test/old')] } });
    const report = compareCrawlRuns(current, baseline, { projectId: 'project-a' });

    expect(report.status).toBe('comparable');
    expect(report.removed).toEqual([expect.objectContaining({ url: 'https://site.test/old', observation: 'not-observed' })]);
    expect(report.provenance).toMatchObject({ source: 'stored-crawl-runs', scopeMatched: true, projectId: 'project-a' });
    expect(report.provenance.baseline).toMatchObject({ runId: 'baseline', completedAt: '2026-10-06T10:00:00.000Z', completeness: 'complete' });
  });
  it.each([
    ['different project', run('other', { projectId: 'project-b' }), run('base'), 'different-project'],
    ['different scope', run('other', { config: config({ maxPages: 20 }) }), run('base'), 'different-scope'],
    ['result scope mismatch', run('other', { result: { ...run('x').result, start_url: 'https://other.test/' } }), run('base'), 'different-scope'],
    ['cancelled current', run('other', { result: { ...run('x').result, cancelled: true } }), run('base'), 'current-incomplete'],
    ['timed out baseline', run('other'), run('base', { result: { ...run('x').result, timed_out: true } }), 'baseline-incomplete'],
    ['same run', run('same'), run('same'), 'same-run'],
    ['invalid timestamp', run('other', { completedAt: '' }), run('base'), 'invalid-completion-time'],
  ] as const)('blocks %s comparisons', (_label, current, baseline, reason) => {
    const report = compareCrawlRuns(current, baseline, { projectId: 'project-a' });
    expect(report.status).toBe('blocked');
    expect(report.reasons).toContain(reason);
    expect(report.added).toHaveLength(0);
    expect(report.removed).toHaveLength(0);
  });
  it('marks bounded page evidence partial and never reports baseline removals', () => {
    const current = run('current', { result: { ...run('x').result, pages_crawled: 3, storage_pages_truncated: true } });
    const report = compareCrawlRuns(current, run('baseline'), { projectId: 'project-a' });
    expect(report.status).toBe('partial');
    expect(report.provenance.current.partialReasons).toEqual(expect.arrayContaining(['storage-pages-truncated', 'page-index-truncated']));
    expect(report.removed).toHaveLength(0);
  });
  it('suppresses current additions when baseline page evidence is partial', () => {
    const baseline = run('baseline', { result: { ...run('x').result, pages_crawled: 3, storage_pages_total: 3 } });
    const current = run('current', { result: { ...run('x').result, pages: [page('https://site.test/new')] } });
    const report = compareCrawlRuns(current, baseline, { projectId: 'project-a' });
    expect(report.status).toBe('partial');
    expect(report.added).toHaveLength(0);
    expect(report.provenance.baseline.partial).toBe(true);
  });
  it('records each bounded evidence source and preserves a missing project as unverified', () => {
    const current = run('current', { projectId: 'project-a', result: {
      ...run('x').result, pages_crawled: 3, storage_pages_total: 3, discovery_provenance_truncated: true, resource_limit_reached: true,
    } });
    const baseline = run('baseline', { projectId: undefined });
    const evidence = assessCrawlRun(current);
    expect(evidence.partialReasons).toEqual(expect.arrayContaining([
      'storage-pages-truncated', 'discovery-provenance-truncated', 'resource-limit-reached', 'page-index-truncated',
    ]));
    expect(guardCrawlComparison(current, baseline).reasons).toContain('project-unverified');
    expect(guardCrawlComparison(current, baseline, { projectId: 'project-a' }).reasons).toContain('project-unverified');
    expect(guardCrawlComparison(current, baseline).provenance.projectId).toBe('project-a');
  });
  it('allows explicit environment path matching while retaining config guards', () => {
    const current = run('current', { startUrl: 'https://www.site.test/', result: { ...run('x').result, start_url: 'https://www.site.test/' } });
    const baseline = run('baseline', { startUrl: 'https://staging.site.test/', result: { ...run('x').result, start_url: 'https://staging.site.test/' } });
    const report = compareCrawlRuns(current, baseline, { projectId: 'project-a', matchByPath: true });
    expect(report.status).toBe('comparable');
    expect(report.provenance.scopeMatched).toBe(true);
  });
  it('blocks path matching when the crawl configuration differs', () => {
    const current = run('current', { startUrl: 'https://www.site.test/', config: config({ maxPages: 11 }) });
    const baseline = run('baseline', { startUrl: 'https://staging.site.test/' });
    const report = compareCrawlRuns(current, baseline, { projectId: 'project-a', matchByPath: true });
    expect(report.status).toBe('blocked');
    expect(report.reasons).toContain('different-scope');
    expect(report.provenance.scopeMatched).toBe(false);
  });

  it('blocks path matching when a stored result reports a different start URL', () => {
    const current = run('current', { result: { ...run('x').result, start_url: 'https://site.test/other' } });
    const report = compareCrawlRuns(current, run('baseline'), { projectId: 'project-a', matchByPath: true });
    expect(report.status).toBe('blocked');
    expect(report.reasons).toContain('different-scope');
  });

  it('keeps partial evidence guarded in path mode', () => {
    const baseline = run('baseline', { startUrl: 'https://staging.site.test/', result: { ...run('x').result, pages_crawled: 2, storage_pages_total: 2 } });
    const current = run('current', { startUrl: 'https://www.site.test/' });
    const report = compareCrawlRuns(current, baseline, { projectId: 'project-a', matchByPath: true });
    expect(report.status).toBe('partial');
    expect(report.added).toHaveLength(0);
    expect(report.provenance.scopeMatched).toBe(true);
  });

  it('exposes stable fingerprints and explicit project verification', () => {
    const first = run('first');
    expect(crawlConfigFingerprint(first.config)).toBe(crawlConfigFingerprint({ ...first.config }));
    expect(crawlConfigFingerprint({ ...first.config, resumeCompletedUrls: ['ignored'], userAgent: undefined })).toBe(crawlConfigFingerprint(first.config));
    expect(crawlScopeFingerprint(first)).toBe(crawlScopeFingerprint(first));
    expect(assessCrawlRun({ ...first, projectId: undefined }).partial).toBe(false);
    expect(compareCrawlRuns({ ...first, projectId: undefined }, run('base')).reasons).toContain('project-unverified');
    expect(crawlScopeFingerprint({ ...first, startUrl: 'not a url#fragment' })).not.toBe('');
    expect(crawlComparisonKey('https://site.test/', true)).toBe('/');
  });

  it('does not treat a 32-bit fingerprint collision as matching scope', () => {
    const collidingUserAgents = ['ua-0xon99z0awhq', 'ua-1grla8n1gtsl'];
    const first = run('first', { config: config({ userAgent: collidingUserAgents[0] }) });
    const second = run('second', { config: config({ userAgent: collidingUserAgents[1] }) });

    expect(crawlConfigSignature(first.config)).not.toBe(crawlConfigSignature(second.config));
    expect(crawlScopeFingerprint(first)).toBe(crawlScopeFingerprint(second));
    expect(crawlScopeSignature(first)).not.toBe(crawlScopeSignature(second));
    expect(guardCrawlComparison(first, second).reasons).toContain('different-scope');
    expect(guardCrawlComparison(first, second).provenance.scopeMatched).toBe(false);
  });

  it('ignores resume checkpoints only at the config root', () => {
    const first = run('first', { config: config({ customSearches: [{ id: 'a', name: 'a', selectorType: 'regex', query: 'resumeCompletedUrls', resultType: 'text' }] }) });
    const second = run('second', { config: { ...first.config, resumeCompletedUrls: ['https://site.test/done'] } });

    expect(crawlConfigSignature(first.config)).toBe(crawlConfigSignature(second.config));
    expect(crawlConfigSignature({
      ...first.config,
      customSearches: [{ id: 'a', name: 'a', selectorType: 'regex', query: 'other', resultType: 'text' }],
    })).not.toBe(crawlConfigSignature(first.config));
  });
});

const _reportTypeCheck = (report: CrawlDiffReport): CrawlDiffReport => report;
void _reportTypeCheck;
