import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BenchmarkDeps } from '@/services/siteFocusBenchmark';
import { buildAuthorityReport, buildGapBrief } from '@/services/topicalAuthority';
import { buildTopicalBenchmark, clearAuthorityBriefCache, createReferenceDeps, createSuggestionFetcher, generateGapBrief, runReference, type ReferenceDeps } from '@/services/topicalAuthorityReference';
import { COMPETITORS, NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;
const hits = (domains: string[]) => domains.map((domain, index) => ({ rank: index + 1, url: `https://${domain}/page`, domain }));
const pagesOf = (domain: string) => COMPETITORS.find((item) => item.domain === domain)?.pages ?? COMPETITORS[0].pages;

const deps = (patch: Partial<ReferenceDeps> = {}): ReferenceDeps => ({
  fetchSerp: vi.fn(async () => ({ source: 'bing-rss', hits: hits(['rival-one.test', 'rival-two.test', 'rival-three.test', OWN_HOST]) })),
  crawlSite: vi.fn(async (request) => ({ pages: pagesOf(new URL(request.url).hostname) })),
  fetchSuggestions: vi.fn(async () => ['pour over brewing basics']),
  now: () => NOW,
  ...patch,
});

describe('runReference', () => {
  it('builds the taxonomy from SERP leaders, crawled headings and suggestions', async () => {
    const progress: string[] = [];
    const outcome = await runReference(deps(), { report: ownReport(), startUrl: START, onProgress: (item) => progress.push(item.phase) });
    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.taxonomy.source).toBe('bing-rss');
    expect(outcome.taxonomy.suggestionCount).toBeGreaterThan(0);
    expect(outcome.competitors.map((item) => item.domain).sort()).toEqual(['rival-one.test', 'rival-three.test', 'rival-two.test']);
    expect(new Set(progress)).toEqual(new Set(['serp', 'crawl', 'build']));
  });

  it('reports unavailable states honestly instead of inventing data', async () => {
    const input = { report: ownReport(), startUrl: START };
    expect(await runReference(deps({ fetchSerp: undefined }), input)).toEqual({ status: 'unavailable', reason: 'no-serp-source' });
    expect(await runReference(deps(), { ...input, report: { ...input.report, coreTopic: { ...input.report.coreTopic, label: '', terms: [] } } })).toEqual({ status: 'unavailable', reason: 'no-queries' });
    const failed = await runReference(deps({ fetchSerp: vi.fn(async () => { throw new Error('quota'); }) }), input);
    expect(failed).toEqual({ status: 'unavailable', reason: 'serp-failed', error: 'quota' });
    expect(await runReference(deps({ fetchSerp: vi.fn(async () => ({ source: 's', hits: hits([OWN_HOST]) })) }), input)).toMatchObject({ reason: 'no-competitors' });
    expect(await runReference(deps({ crawlSite: vi.fn(async () => { throw new Error('blocked'); }) }), input)).toMatchObject({ reason: 'no-pages' });
    expect(await runReference(deps({ crawlSite: vi.fn(async () => ({ pages: [], cancelled: true })) }), input)).toMatchObject({ reason: 'no-pages' });
    expect(await runReference(deps({ crawlSite: vi.fn(async () => ({ pages: ownSite().slice(5) })) }), input)).toMatchObject({ reason: 'no-taxonomy' });
  });

  it('works without suggestions, tolerates failing suggestion lookups and honours cancellation', async () => {
    const input = { report: ownReport(), startUrl: START };
    expect((await runReference(deps({ fetchSuggestions: undefined }), input)).status).toBe('ok');
    expect((await runReference(deps({ fetchSuggestions: vi.fn(async () => { throw new Error('x'); }) }), input)).status).toBe('ok');
    const early = new AbortController();
    early.abort();
    expect(await runReference(deps(), { ...input, signal: early.signal })).toEqual({ status: 'cancelled' });
    const late = new AbortController();
    const crawling = deps({ crawlSite: vi.fn(async (request) => { late.abort(); return { pages: pagesOf(new URL(request.url).hostname) }; }) });
    expect(await runReference(crawling, { ...input, signal: late.signal })).toEqual({ status: 'cancelled' });
  });
});

describe('topical benchmark', () => {
  it('scores the top competitors with the same engine and builds like-for-like insights', () => {
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const own = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy, now: NOW });
    const benchmark = buildTopicalBenchmark(own, OWN_HOST, COMPETITORS, taxonomy, NOW)!;
    expect(benchmark.rows).toHaveLength(4);
    expect(benchmark.rows.filter((row) => row.isOwn)).toHaveLength(1);
    expect(benchmark.ownRank).toBe(benchmark.rows.findIndex((row) => row.isOwn) + 1);
    expect(benchmark.pillars.length).toBe(own.pillarCoverage.length);
    expect(benchmark.insights[0].code).toBe('rank');
    expect(benchmark.insights.every((insight) => ['rank', 'lead-pillar', 'trailing-pillars'].includes(insight.code))).toBe(true);
    expect(buildTopicalBenchmark(own, OWN_HOST, [], taxonomy, NOW)).toBeNull();
    expect(buildTopicalBenchmark(own, OWN_HOST, [{ domain: 'x.test', pages: [] }], taxonomy, NOW)).toBeNull();
  });

  it('reports a lead pillar when the site beats every competitor', () => {
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const own = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy, now: NOW });
    const strong = { ...own, pillarCoverage: own.pillarCoverage.map((pillar) => ({ ...pillar, coveragePct: 100 })), tas: 90 };
    const weak = { ...own, pillarCoverage: own.pillarCoverage.map((pillar) => ({ ...pillar, coveragePct: 0 })) };
    expect(buildTopicalBenchmark(strong, OWN_HOST, COMPETITORS.slice(0, 1), { ...taxonomy, subtopics: taxonomy.subtopics.slice(0, 1) }, NOW)!.insights.map((i) => i.code)).toContain('lead-pillar');
    const trailing = buildTopicalBenchmark(weak, OWN_HOST, COMPETITORS, taxonomy, NOW)!;
    expect(trailing.insights.map((item) => item.code)).toContain('trailing-pillars');
  });
});

describe('adapters', () => {
  it('wraps Google Suggest and swallows failures', async () => {
    const ok = createSuggestionFetcher({ geo: 'US', language: 'en', fetch: async () => ({ status: 'ok', result: { suggestions: ['a', 'b'] } }) });
    expect(await ok('coffee')).toEqual(['a', 'b']);
    expect(await createSuggestionFetcher({ geo: 'US', language: 'en', fetch: async () => ({ status: 'blocked', result: null }) })('x')).toEqual([]);
    expect(await createSuggestionFetcher({ geo: 'US', language: 'en', fetch: async () => { throw new Error('offline'); } })('x')).toEqual([]);
  });

  it('wires the benchmark SERP and crawl dependencies plus suggestions', () => {
    const wired = createReferenceDeps();
    expect(typeof wired.crawlSite).toBe('function');
    expect(typeof wired.fetchSuggestions).toBe('function');
    const base: Pick<BenchmarkDeps, 'crawlSite'> = wired;
    expect(base.crawlSite).toBeDefined();
  });
});

describe('AI gap brief', () => {
  beforeEach(() => clearAuthorityBriefCache());
  const brief = () => {
    const pages = ownSite();
    const taxonomy = referenceTaxonomy(pages)!;
    const extended = { ...taxonomy, subtopics: [...taxonomy.subtopics, { id: 'g-1', pillar: 'general', label: 'cold brew chemistry', keys: ['coldx'], importance: 0.9, entities: ['nitrogen'], questions: [] }] };
    const report = buildAuthorityReport(pages, START, ownReport(pages), { taxonomy: extended, now: NOW });
    return buildGapBrief(report, report.coverage.find((row) => row.subtopicId === 'g-1')!);
  };

  it('generates, sanitizes, caches and reports every failure mode', async () => {
    const generateText = vi.fn(async () => '```text\n<b>Title</b>\n\n\n\nOutline\n```');
    const live = { isConfigured: () => true, generateText };
    const first = await generateGapBrief(live, brief(), 'coffee', 'en');
    expect(first).toEqual({ status: 'ok', text: 'Title\n\nOutline', cached: false });
    expect(await generateGapBrief(live, brief(), 'coffee', 'en')).toMatchObject({ status: 'ok', cached: true });
    expect(await generateGapBrief(live, brief(), 'coffee', 'en', { force: true })).toMatchObject({ cached: false });
    expect(generateText).toHaveBeenCalledTimes(2);
    clearAuthorityBriefCache();
    expect(await generateGapBrief({ isConfigured: () => false, generateText }, brief(), 'c', 'en')).toEqual({ status: 'no-key' });
    expect(await generateGapBrief({ isConfigured: () => true, generateText: async () => '  ' }, brief(), 'c', 'en')).toEqual({ status: 'empty' });
    expect(await generateGapBrief({ isConfigured: () => true, generateText: async () => { throw new Error('rate'); } }, brief(), 'c', 'en')).toEqual({ status: 'error', message: 'rate' });
    expect(await generateGapBrief({ isConfigured: () => true, generateText: async () => { throw 'plain'; } }, brief(), 'c', 'en')).toEqual({ status: 'error', message: 'plain' });
    const stopped = new AbortController();
    stopped.abort();
    expect(await generateGapBrief(live, brief(), 'c', 'en', { signal: stopped.signal })).toEqual({ status: 'cancelled' });
    const mid = new AbortController();
    expect(await generateGapBrief({ isConfigured: () => true, generateText: async () => { mid.abort(); return 'text'; } }, brief(), 'c', 'en', { signal: mid.signal })).toEqual({ status: 'cancelled' });
    const failing = new AbortController();
    expect(await generateGapBrief({ isConfigured: () => true, generateText: async () => { failing.abort(); throw new Error('x'); } }, brief(), 'c', 'en', { signal: failing.signal })).toEqual({ status: 'cancelled' });
  });
});
