import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { PagePlaybookPanel } from '@/components/Domain/crawlResults/focus/PagePlaybookPanel';
import { BenchmarkResults } from '@/components/Domain/crawlResults/focus/benchmark/BenchmarkResults';
import { useFocusBenchmark } from '@/components/Domain/crawlResults/focus/benchmark/useFocusBenchmark';
import { buildTreeRows } from '@/components/Domain/crawlResults/focus/focusHelpers';
import { DataForSEOClient } from '@/services/dataforseo';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { benchmarkQueries, buildGaps, buildInsights, buildRanking, createBenchmarkDeps, pickCompetitors, runBenchmark, type BenchmarkOutcome, type BenchmarkReport, type CompetitorResult } from '@/services/siteFocusBenchmark';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToolsStore } from '@/stores/toolsStore';
import { diabetesSite } from './siteFocusFixtures';

const report = buildSiteFocusReport(diabetesSite(), 'https://diabetes.test/');
const summary = (score: number, coreTerms: string[]) => ({ score, band: 'good' as const, onTopicRatio: 50, confidence: 50, pageCount: 5, offTopicPages: 1, coreTerms, generatedAt: 'T' });
const rival = (domain: string, score: number, coreTerms: string[] = []): CompetitorResult => ({ domain, startUrl: '', serpAppearances: 1, bestRank: 1, status: 'ok', summary: summary(score, coreTerms) });

afterEach(cleanup);

describe('benchmark ordering and empty keys', () => {
  it('breaks ties deterministically (own first, then domain, then term)', () => {
    const rows = buildRanking(report, 'a.test', [rival('b.test', report.score), rival('0.test', report.score)]);
    expect(rows.map((row) => row.domain)).toEqual(['a.test', '0.test', 'b.test']);
    const { gaps } = buildGaps(report, [rival('x.test', 50, ['zeta', 'alpha']), rival('y.test', 50, ['alpha', 'zeta'])]);
    expect(gaps.map((gap) => gap.term)).toEqual(['alpha', 'zeta']);
    const hit = (domain: string) => ({ rank: 1, url: `https://${domain}/`, domain });
    expect(pickCompetitors([[hit('b.test'), hit('a.test')]], 'me.test', 5).map((item) => item.domain)).toEqual(['a.test', 'b.test']);
  });
  it('ignores terms without a usable key', () => {
    const empty = { ...report, coreTopic: { ...report.coreTopic, terms: [{ ...report.coreTopic.terms[0], term: '' }] } };
    expect(buildInsights(empty, [rival('x.test', 60, [''])]).length).toBeGreaterThan(0);
    expect(buildGaps(empty, [rival('x.test', 60, ['', ''])]).gaps).toEqual([]);
  });
  it('reports cancellation when aborted during the last SERP lookup', async () => {
    const controller = new AbortController();
    const total = benchmarkQueries({ report, startUrl: 'https://diabetes.test/' }).length;
    let calls = 0;
    const fetchSerp = vi.fn(async () => { calls += 1; if (calls === total) controller.abort(); return { source: 'dataforseo' as const, hits: [] }; });
    const outcome = await runBenchmark({ fetchSerp, crawlSite: vi.fn() }, { report, startUrl: 'https://diabetes.test/', signal: controller.signal });
    expect(outcome).toEqual({ status: 'cancelled' });
  });
});

describe('createBenchmarkDeps credentials wiring', () => {
  it('builds a DataForSEO client and honours market overrides', async () => {
    const spy = vi.spyOn(DataForSEOClient.prototype, 'getSerpCompetitors').mockResolvedValue([]);
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'a', password: 'b' } });
    useToolsStore.setState({ keywordCountry: '', keywordLanguage: '' } as never);
    await createBenchmarkDeps().fetchSerp?.('kw');
    useToolsStore.setState({ keywordCountry: 'PL', keywordLanguage: 'pl' } as never);
    await createBenchmarkDeps().fetchSerp?.('kw');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][2]).toBe('en');
    expect(spy.mock.calls[1][2]).toBe('pl');
    spy.mockRestore();
    useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } });
  });
});

describe('focus components edge branches', () => {
  it('keeps URL order for identical paths', () => {
    const [a, b] = report.pages;
    const rows = buildTreeRows([{ ...b, url: 'https://diabetes.test/p?x=2' }, { ...a, url: 'https://diabetes.test/p?x=1' }]);
    const urls = rows.flatMap((row) => (row.kind === 'page' ? [row.page.url] : []));
    expect(urls).toEqual(['https://diabetes.test/p?x=1', 'https://diabetes.test/p?x=2']);
  });
  it('renders failures without failure code or error text', () => {
    const bare: CompetitorResult = { domain: 'bare.test', startUrl: '', serpAppearances: 1, bestRank: 1, status: 'failed' };
    const full = { queries: [], serpSource: 'dataforseo', ranking: [], ownRank: 1, competitors: [bare], industryAverage: null, insights: [], targetScore: 80, gaps: [], competitorTerms: [], pagesPerCompetitor: 5, generatedAt: 'T' } as unknown as BenchmarkReport;
    render(<BenchmarkResults report={full} />);
    expect(screen.getByText(/bare\.test/)).toBeTruthy();
  });
  it('copies the rewrite brief prompt for non-A/B playbooks only when a brief exists', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const page = [...report.pages].filter((p) => !p.skipped && p.playbook !== 'C').sort((a, b) => a.trs - b.trs)[0];
    render(<PagePlaybookPanel page={page} report={report} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledOnce();
  });
});

describe('useFocusBenchmark superseded runs', () => {
  it('ignores results, progress and errors of aborted runs', async () => {
    const pending: Array<{ resolve: (o: BenchmarkOutcome) => void; reject: (e: unknown) => void; progress: (p: never) => void }> = [];
    const runner = vi.fn((input: { onProgress?: (p: never) => void }) => new Promise<BenchmarkOutcome>((resolve, reject) => { pending.push({ resolve, reject, progress: input.onProgress as never }); }));
    const { result } = renderHook(() => useFocusBenchmark(runner as never));
    const input = { report, startUrl: 'https://diabetes.test/' };
    act(() => { void result.current.start(input); });
    act(() => { void result.current.start(input); });
    await act(async () => { pending[0].progress({ phase: 'serp', done: 1, total: 2 } as never); pending[0].resolve({ status: 'cancelled' }); });
    expect(result.current.state.outcome).toBeNull();
    expect(result.current.state.progress).toBeNull();
    act(() => { void result.current.start(input); });
    await act(async () => { pending[1].reject(new Error('stale')); });
    expect(result.current.state.error).toBeNull();
    await act(async () => { pending[2].resolve({ status: 'cancelled' }); });
    expect(result.current.state.outcome).toEqual({ status: 'cancelled' });
  });
});
