import { describe, expect, it, vi } from 'vitest';
import { buildSiteFocusReport, type FocusPage } from '@/services/siteFocus';
import { benchmarkQueries, hostOf, pickCompetitors, runBenchmark, type BenchmarkDeps, type BenchmarkInput } from '@/services/siteFocusBenchmark';
import { DIABETES_TERMS, PHONE_TERMS, diabetesSite, makePage, topicArticles } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
const own = buildSiteFocusReport(diabetesSite(), START, { now: '2026-10-15T00:00:00Z' });
const focused = (host: string): FocusPage[] => [makePage(host, { path: '/', title: 'Home', terms: DIABETES_TERMS.slice(0, 20).map((t) => [t, 3] as [string, number]) }), ...topicArticles(host, '/a', DIABETES_TERMS, 10)];
const phones = (host: string): FocusPage[] => topicArticles(host, '/p', PHONE_TERMS, 10);
const hit = (rank: number, host: string) => ({ rank, url: `https://${host}/page`, domain: host });

const baseInput = (patch: Partial<BenchmarkInput> = {}): BenchmarkInput => ({ report: own, startUrl: START, ...patch });
const okDeps = (pages: Record<string, FocusPage[] | Error | 'cancel'> = {}): BenchmarkDeps => ({
  now: () => 'T',
  fetchSerp: vi.fn(async () => ({ source: 'dataforseo', hits: [hit(1, 'www.alpha.test'), hit(2, 'diabetes.test'), hit(3, 'beta.test'), hit(4, 'alpha.test'), hit(5, 'gamma.test'), { rank: 6, url: '', domain: '' }] })),
  crawlSite: vi.fn(async ({ url, onPages }) => {
    onPages?.(3);
    const host = hostOf(url);
    const value = host in pages ? pages[host] : focused(host);
    if (value instanceof Error) throw value;
    if (value === 'cancel') return { pages: [], cancelled: true };
    return { pages: value };
  }),
});


describe('domains', () => {
  it('normalizes hosts', () => {
    expect(hostOf('https://WWW.Example.com/x')).toBe('example.com');
    expect(hostOf('example.com/x')).toBe('example.com');
    expect(hostOf('http://')).toBe('');
  });
  it('collapses hits, skips own site and orders deterministically', () => {
    const picked = pickCompetitors([[hit(1, 'b.test'), hit(2, 'a.test'), hit(3, 'b.test'), hit(4, 'me.test')], [hit(1, 'a.test'), { rank: 2, url: 'not a url', domain: 'c.test' }]], 'https://www.me.test', 5);
    expect(picked.map((c) => [c.domain, c.appearances, c.bestRank])).toEqual([['a.test', 2, 1], ['b.test', 1, 1], ['c.test', 1, 2]]);
    expect(picked[2].startUrl).toBe('https://c.test/');
    expect(picked[0].startUrl).toBe('https://a.test/');
    expect(pickCompetitors([[hit(1, 'a.test')]], 'x.test', 0)).toEqual([]);
    expect(pickCompetitors([[{ rank: 1, url: 'https://q.test/p', domain: '' }]], 'x.test', 3)[0].domain).toBe('q.test');
  });
});

describe('queries', () => {
  it('uses core topic terms, falls back to the label, and respects the cap', () => {
    expect(benchmarkQueries(baseInput()).length).toBe(3);
    expect(benchmarkQueries(baseInput({ maxQueries: 0 })).length).toBe(1);
    const label = { ...own, coreTopic: { ...own.coreTopic, terms: [], label: ' Diabetes ' } };
    expect(benchmarkQueries(baseInput({ report: label }))).toEqual(['Diabetes']);
    expect(benchmarkQueries(baseInput({ report: { ...label, coreTopic: { ...label.coreTopic, label: '' } } }))).toEqual([]);
  });
});

describe('runBenchmark', () => {
  it('reports no SERP source explicitly', async () => {
    expect(await runBenchmark({ crawlSite: vi.fn() }, baseInput())).toEqual({ status: 'unavailable', reason: 'no-serp-source' });
  });
  it('reports missing queries', async () => {
    const empty = { ...own, coreTopic: { ...own.coreTopic, terms: [], label: '' } };
    expect(await runBenchmark(okDeps(), baseInput({ report: empty }))).toEqual({ status: 'unavailable', reason: 'no-queries' });
  });
  it('reports SERP failures and empty competitor sets', async () => {
    const failing: BenchmarkDeps = { crawlSite: vi.fn(), fetchSerp: vi.fn().mockRejectedValue(new Error('quota')) };
    expect(await runBenchmark(failing, baseInput())).toEqual({ status: 'unavailable', reason: 'serp-failed', error: 'quota' });
    const stringy: BenchmarkDeps = { crawlSite: vi.fn(), fetchSerp: vi.fn().mockRejectedValue('boom') };
    expect(await runBenchmark(stringy, baseInput())).toMatchObject({ error: 'boom' });
    const onlyMe: BenchmarkDeps = { crawlSite: vi.fn(), fetchSerp: vi.fn().mockResolvedValue({ source: 's', hits: [hit(1, 'diabetes.test')] }) };
    expect(await runBenchmark(onlyMe, baseInput())).toEqual({ status: 'unavailable', reason: 'no-competitors' });
  });
  it('survives a partly failing SERP', async () => {
    let calls = 0;
    const deps = okDeps();
    deps.fetchSerp = vi.fn(async () => { calls += 1; if (calls === 1) throw new Error('x'); return { source: 'dataforseo', hits: [hit(1, 'alpha.test')] }; });
    const outcome = await runBenchmark(deps, baseInput());
    expect(outcome.status).toBe('ok');
  });
  it('builds ranking, insights, gaps and per-competitor failures', async () => {
    const progress: string[] = [];
    const deps = okDeps({ 'beta.test': new Error('dns'), 'gamma.test': [], 'alpha.test': phones('alpha.test') });
    const outcome = await runBenchmark(deps, baseInput({ pagesPerCompetitor: 12, concurrency: 5, onProgress: (p) => progress.push(p.phase) }));
    if (outcome.status !== 'ok') throw new Error('expected ok');
    const { report } = outcome;
    expect(report.generatedAt).toBe('T');
    expect(report.serpSource).toBe('dataforseo');
    expect(report.pagesPerCompetitor).toBe(12);
    expect(report.competitors.map((c) => [c.domain, c.failure])).toEqual([['alpha.test', undefined], ['beta.test', 'crawl-error'], ['gamma.test', 'no-pages']]);
    expect(report.competitors[1].error).toBe('dns');
    expect(report.ranking.find((r) => r.isOwn)?.domain).toBe('diabetes.test');
    expect(report.ranking.map((r) => r.rank)).toEqual([1, 2]);
    expect(report.industryAverage).not.toBeNull();
    expect(report.insights.map((i) => i.code)).toEqual(['on-topic-share', 'off-topic-pages', 'keyword-coverage', 'versus-average']);
    expect(report.targetScore).toBeGreaterThanOrEqual(80);
    expect(progress).toContain('serp');
    expect(progress).toContain('crawl');
    expect(progress).toContain('analyze');
    expect(deps.crawlSite).toHaveBeenCalledWith(expect.objectContaining({ maxPages: 12 }));
    expect(report.gaps.every((g) => g.coveragePct > 0 && g.coveragePct <= 100)).toBe(true);
  });
  it('uses defaults and handles analysis failures', async () => {
    const deps = okDeps();
    const bad = [{ url: 'https://alpha.test/', get links(): never { throw new Error('bad page'); } } as unknown as FocusPage];
    deps.crawlSite = vi.fn(async ({ url }) => (hostOf(url) === 'alpha.test' ? { pages: bad } : { pages: focused(hostOf(url)) }));
    const outcome = await runBenchmark(deps, baseInput());
    if (outcome.status !== 'ok') throw new Error('expected ok');
    expect(outcome.report.competitors.find((c) => c.domain === 'alpha.test')?.failure).toBe('analysis-failed');
    expect(outcome.report.pagesPerCompetitor).toBe(20);
  });
  it('reports analysis failures with string errors', async () => {
    const deps = okDeps();
    deps.crawlSite = vi.fn(async () => ({ pages: [null as unknown as FocusPage] }));
    const outcome = await runBenchmark(deps, baseInput());
    if (outcome.status !== 'ok') throw new Error('expected ok');
    expect(outcome.report.competitors.every((c) => c.failure === 'analysis-failed')).toBe(true);
    expect(outcome.report.industryAverage).toBeNull();
    expect(outcome.report.insights).toEqual([]);
    expect(outcome.report.gaps).toEqual([]);
    expect(outcome.report.targetScore).toBe(80);
  });
});
