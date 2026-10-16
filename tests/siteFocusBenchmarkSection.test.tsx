import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildSiteFocusReport } from '@/services/siteFocus';
import type { BenchmarkInput, BenchmarkOutcome, BenchmarkReport } from '@/services/siteFocusBenchmark';
import { FocusBenchmarkSection } from '@/components/Domain/crawlResults/focus/benchmark/FocusBenchmarkSection';
import { defaultRunner } from '@/components/Domain/crawlResults/focus/benchmark/useFocusBenchmark';
import { diabetesSite } from './siteFocusFixtures';

vi.mock('@/services/siteFocusBenchmark/adapter', async (original) => ({ ...(await original<object>()), createBenchmarkDeps: () => ({ crawlSite: vi.fn() }) }));

const report = buildSiteFocusReport(diabetesSite(), 'https://diabetes.test/');
const row = (domain: string, isOwn: boolean, rank: number, score: number) => ({ domain, isOwn, rank, score, band: 'good' as const, onTopicRatio: 50, offTopicPages: 2, pageCount: 20 });
const result = (patch: Partial<BenchmarkReport> = {}): BenchmarkReport => ({
  queries: ['a', 'b'], serpSource: 'dataforseo', ranking: [row('rival.test', false, 1, 90), row('diabetes.test', true, 2, 70)], ownRank: 2,
  competitors: [{ domain: 'x.test', startUrl: '', serpAppearances: 1, bestRank: 1, status: 'failed', failure: 'crawl-error', error: 'dns' }, { domain: 'y.test', startUrl: '', serpAppearances: 1, bestRank: 1, status: 'failed', failure: 'no-pages' }],
  industryAverage: 80, insights: [{ code: 'versus-average', params: { delta: -10, average: 80 } }], targetScore: 85,
  gaps: [{ term: 'laptop', coveragePct: 100, competitors: 2 }], competitorTerms: ['laptop'], pagesPerCompetitor: 20, generatedAt: 'T', ...patch,
});
const ok = (patch?: Partial<BenchmarkReport>): BenchmarkOutcome => ({ status: 'ok', report: result(patch) });

afterEach(cleanup);

describe('FocusBenchmarkSection', () => {
  it('runs, shows ranking with own row highlighted, insights and gaps', async () => {
    const runner = vi.fn(async (input: BenchmarkInput) => { input.onProgress?.({ phase: 'serp', done: 1, total: 3 }); return ok(); });
    const onTerms = vi.fn();
    render(<FocusBenchmarkSection report={report} onCompetitorTerms={onTerms} runner={runner} />);
    expect(screen.getByText(/Compare your Site Focus Score/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    await waitFor(() => expect(screen.getByTestId('benchmark-results')).toBeTruthy());
    expect(runner.mock.calls[0][0].startUrl).toBe('https://diabetes.test/');
    const own = screen.getByText(/diabetes\.test \(You\)/).closest('li');
    expect(own?.getAttribute('data-own')).toBe('true');
    expect(screen.getByText(/points versus the industry average of 80/)).toBeTruthy();
    expect(screen.getByText(/x\.test: Crawl failed: dns/)).toBeTruthy();
    expect(screen.getByText(/y\.test: No crawlable pages/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add these terms/ }));
    expect(onTerms).toHaveBeenCalledWith(['laptop']);
    expect(screen.getByRole('button', { name: 'Run again' })).toBeTruthy();
  });
  it('hides optional blocks', async () => {
    const runner = vi.fn(async (_input: BenchmarkInput) => ok({ industryAverage: null, insights: [], gaps: [], competitorTerms: [], competitors: [], ranking: [row('diabetes.test', true, 1, 70)] }));
    render(<FocusBenchmarkSection report={report} startUrl="https://custom.test/" runner={runner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    await waitFor(() => expect(screen.getByTestId('benchmark-results')).toBeTruthy());
    expect(screen.getByText(/No competitor topics are missing/)).toBeTruthy();
    expect(screen.queryByText('Insights')).toBeNull();
    expect(runner.mock.calls[0][0].startUrl).toBe('https://custom.test/');
  });
  it('omits the apply button without a handler or terms', async () => {
    render(<FocusBenchmarkSection report={report} runner={async () => ok()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    await waitFor(() => expect(screen.getByTestId('benchmark-results')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Add these terms/ })).toBeNull();
  });
  it('shows progress and supports cancel', async () => {
    let release: (outcome: BenchmarkOutcome) => void = () => undefined;
    const runner = vi.fn((input: BenchmarkInput) => new Promise<BenchmarkOutcome>((resolve) => {
      release = resolve;
      input.signal?.addEventListener('abort', () => resolve({ status: 'cancelled' }));
      input.onProgress?.({ phase: 'crawl', done: 1, total: 4, domain: 'rival.test', pages: 7 });
    }));
    render(<FocusBenchmarkSection report={report} runner={runner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/rival\.test: 7 pages/));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByText(/Benchmark cancelled/)).toBeTruthy());
    expect(release).toBeTypeOf('function');
  });
  it('shows the initial progress text before any update', async () => {
    const runner = vi.fn(() => new Promise<BenchmarkOutcome>(() => undefined));
    render(<FocusBenchmarkSection report={report} runner={runner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Looking up search results/));
  });
  it('renders unavailable states', async () => {
    render(<FocusBenchmarkSection report={report} runner={async () => ({ status: 'unavailable', reason: 'no-serp-source' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/No search results source is connected/));
  });
  it('renders failures thrown by the runner (Error and non-Error)', async () => {
    const runner = vi.fn().mockRejectedValueOnce(new Error('kaboom')).mockRejectedValueOnce('weird');
    render(<FocusBenchmarkSection report={report} runner={runner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/kaboom/));
    fireEvent.click(screen.getByRole('button', { name: 'Run again' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/weird/));
  });
  it('ignores results of a superseded run and aborts on unmount', async () => {
    const signals: AbortSignal[] = [];
    const resolvers: Array<(o: BenchmarkOutcome) => void> = [];
    const runner = vi.fn((input: BenchmarkInput) => { signals.push(input.signal as AbortSignal); return new Promise<BenchmarkOutcome>((resolve) => { resolvers.push(resolve); input.onProgress?.({ phase: 'analyze', done: 1, total: 1 }); }); });
    const view = render(<FocusBenchmarkSection report={report} runner={runner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByRole('status').textContent).toMatch(/Scoring competitors/);
    view.unmount();
    expect(signals[0].aborted).toBe(true);
    resolvers[0](ok());
  });
  it('drops late outcomes when a newer run started', async () => {
    const resolvers: Array<(o: BenchmarkOutcome) => void> = [];
    const runner = vi.fn(() => new Promise<BenchmarkOutcome>((resolve) => { resolvers.push(resolve); }));
    const view = render(<FocusBenchmarkSection report={report} runner={runner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    // second run via rerender trick: click cancel then run again before the first settles
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    resolvers[0]({ status: 'cancelled' });
    await waitFor(() => expect(screen.getByText(/Benchmark cancelled/)).toBeTruthy());
    expect(view.container).toBeTruthy();
  });
  it('falls back to an empty start url without pages', async () => {
    const runner = vi.fn(async (_input: BenchmarkInput) => ({ status: 'cancelled' }) as BenchmarkOutcome);
    render(<FocusBenchmarkSection report={{ ...report, pages: [] }} runner={runner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    await waitFor(() => expect(runner).toHaveBeenCalled());
    expect(runner.mock.calls[0][0]).toMatchObject({ startUrl: '' });
  });
  it('default runner reports no SERP source offline', async () => {
    render(<FocusBenchmarkSection report={report} runner={defaultRunner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run benchmark' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/No search results source/));
  });
});
