import { describe, expect, it, vi } from 'vitest';
import { buildSiteFocusReport, type FocusPage, type PageFocus } from '@/services/siteFocus';
import { buildGaps, buildInsights, buildRanking, hostOf, industryAverage, runBenchmark, targetFor, type BenchmarkDeps, type BenchmarkInput, type CompetitorResult } from '@/services/siteFocusBenchmark';
import { DIABETES_TERMS, diabetesSite, makePage, topicArticles } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
const own = buildSiteFocusReport(diabetesSite(), START, { now: '2026-10-15T00:00:00Z' });
const focused = (host: string): FocusPage[] => [makePage(host, { path: '/', title: 'Home', terms: DIABETES_TERMS.slice(0, 20).map((t) => [t, 3] as [string, number]) }), ...topicArticles(host, '/a', DIABETES_TERMS, 10)];
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


describe('runBenchmark', () => {
  it('supports cancellation at every stage', async () => {
    const before = new AbortController(); before.abort();
    expect(await runBenchmark(okDeps(), baseInput({ signal: before.signal }))).toEqual({ status: 'cancelled' });

    const afterSerp = new AbortController();
    const deps = okDeps();
    deps.fetchSerp = vi.fn(async () => { afterSerp.abort(); return { source: 's', hits: [hit(1, 'a.test')] }; });
    expect(await runBenchmark(deps, baseInput({ signal: afterSerp.signal }))).toEqual({ status: 'cancelled' });

    const midCrawl = new AbortController();
    const crawlDeps = okDeps();
    crawlDeps.crawlSite = vi.fn(async () => { midCrawl.abort(); return { pages: [], cancelled: true }; });
    expect(await runBenchmark(crawlDeps, baseInput({ signal: midCrawl.signal, concurrency: 1 }))).toEqual({ status: 'cancelled' });

    const signalOnly = new AbortController();
    const mid = okDeps();
    mid.crawlSite = vi.fn(async ({ url }) => { signalOnly.abort(); return { pages: focused(hostOf(url)) }; });
    expect(await runBenchmark(mid, baseInput({ signal: signalOnly.signal }))).toEqual({ status: 'cancelled' });
  });
  it('treats a cancelled crawl without abort as no pages', async () => {
    const outcome = await runBenchmark(okDeps({ 'alpha.test': 'cancel' }), baseInput());
    if (outcome.status !== 'ok') throw new Error('expected ok');
    expect(outcome.report.competitors[0].failure).toBe('no-pages');
  });
  it('marks pending crawls cancelled when abort lands between crawls', async () => {
    const controller = new AbortController();
    const deps = okDeps();
    deps.crawlSite = vi.fn(async ({ url }) => { controller.abort(); return { pages: focused(hostOf(url)) }; });
    expect(await runBenchmark(deps, baseInput({ signal: controller.signal, concurrency: 1 }))).toEqual({ status: 'cancelled' });
  });
  it('lets the engine detect the language when the own model has none', async () => {
    const noLanguage = { ...own, model: { ...own.model, language: '' } };
    expect((await runBenchmark(okDeps(), baseInput({ report: noLanguage }))).status).toBe('ok');
  });
  it('falls back to the default clock', async () => {
    const deps = okDeps();
    delete deps.now;
    const outcome = await runBenchmark(deps, baseInput({ targetScore: 150 }));
    if (outcome.status !== 'ok') throw new Error('expected ok');
    expect(outcome.report.generatedAt).toMatch(/^\d{4}-/);
    expect(outcome.report.targetScore).toBe(100);
  });
  it('falls back to the start url when the host is unknown', async () => {
    const outcome = await runBenchmark(okDeps(), baseInput({ startUrl: '::' }));
    if (outcome.status !== 'ok') throw new Error('expected ok');
    expect(outcome.report.ranking.some((r) => r.domain === '::')).toBe(true);
  });
});

describe('analysis helpers', () => {
  const summary = (score: number, terms: string[] = []): CompetitorResult => ({ domain: `s${score}.test`, startUrl: '', serpAppearances: 1, bestRank: 1, status: 'ok', summary: { score, band: 'good', confidence: 80, onTopicRatio: score, pageCount: 10, offTopicPages: 1, coreTerms: terms } });
  it('computes average, target hint and override', () => {
    expect(industryAverage([])).toBeNull();
    expect(industryAverage([summary(60), summary(81)])).toBe(70.5);
    expect(targetFor([summary(95), summary(90), summary(85), summary(10)])).toBe(90);
    expect(targetFor([summary(50)])).toBe(80);
    expect(targetFor([], -5 as number)).toBe(0);
  });
  it('ranks own site first on ties and handles failures', () => {
    const rows = buildRanking(own, 'diabetes.test', [{ ...summary(own.score), domain: 'z.test' }, { ...summary(own.score), domain: 'a.test' }, { domain: 'f.test', startUrl: '', serpAppearances: 1, bestRank: 1, status: 'failed', failure: 'no-pages' }]);
    expect(rows.map((r) => r.domain)).toEqual(['diabetes.test', 'a.test', 'z.test']);
  });
  it('computes coverage percentages from crawled competitors only', () => {
    const competitors = [summary(70, ['laptop', 'zebra stripes']), summary(80, ['laptop', 'metformin']), summary(90, ['laptop', 'laptop']), { ...summary(50), summary: undefined, status: 'failed' as const }];
    const { gaps, competitorTerms } = buildGaps(own, competitors);
    expect(gaps.find((g) => g.term === 'laptop')).toMatchObject({ coveragePct: 100, competitors: 3 });
    expect(gaps.find((g) => g.term === 'zebra stripes')).toMatchObject({ coveragePct: 33, competitors: 1 });
    expect(gaps.find((g) => g.term === 'metformin')).toBeUndefined();
    expect(competitorTerms).toEqual(['laptop']);
    expect(buildGaps(own, [summary(70, ['']), summary(70, ['laptop'])]).competitorTerms).toEqual([]);
    expect(buildGaps(own, [summary(70, ['laptop'])]).competitorTerms).toEqual(['laptop']);
  });
  it('skips keyword coverage insight when leaders have no terms', () => {
    expect(buildInsights(own, [summary(70)]).map((i) => i.code)).toEqual(['on-topic-share', 'off-topic-pages', 'versus-average']);
  });
  it('ignores skipped pages when counting off-topic pages', () => {
    const skipped: PageFocus = { ...own.pages[0], status: 'off-topic', skipped: 'no-content' };
    const rows = buildRanking({ ...own, pages: [skipped] }, 'x.test', []);
    expect(rows[0].offTopicPages).toBe(0);
  });
});
