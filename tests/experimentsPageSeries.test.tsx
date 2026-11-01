import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { PageSeriesLoader } from '@/components/Charts/experiments/PageSeriesLoader';
import { StructuralImpactSection } from '@/components/Charts/experiments/StructuralImpactSection';
import { ExperimentCard } from '@/components/Charts/experiments/ExperimentCard';
import { ExperimentsPanel } from '@/components/Charts/ExperimentsPanel';
import { causalPageFor } from '@/services/experiments/pageCausal';
import { fetchPageSeries, loadPageSeries, MAX_SAVED_PAGES, pageSeriesKey, pageWindow, parsePageDaily, savePageSeries, type PageSeries } from '@/services/experiments/pageSeries';
import { addIntervention, type Intervention } from '@/services/experiments/registry';
import { estimateStructuralImpact } from '@/services/experiments/structuralImpact';
import { weekday } from '@/services/experiments/structuralModel';
import { invokeTauriCommand } from '@/services/tauri/transport';
import { useToolsStore } from '@/stores/toolsStore';
import type { CrawledPageSummary } from '@/types';

vi.mock('@/services/tauri/transport', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
const NOW = new Date('2026-06-01T00:00:00Z');
const URL_A = 'https://a.test/page';
const URL_B = 'https://a.test/other';
const DAY = 86_400_000;
const days = Array.from({ length: 60 }, (_, i) => new Date(Date.parse('2026-02-01T00:00:00Z') + i * DAY).toISOString().slice(0, 10));
const WEEK = [10, 12, 14, 13, 11, -25, -28];
const wiggle = (i: number) => ((i * 7919) % 13) - 6;
const series = (site: string, fn: (date: string, i: number) => number): PageSeries => ({ site, fetchedAt: NOW.toISOString(), daily: days.map((date, i) => ({ date, clicks: Math.max(0, fn(date, i)) })) });
const intervention = (url: string, date = '2026-03-18'): Intervention => ({ id: 'i1', projectId: 'p', url, date, kind: 'content', note: '', createdAt: NOW.toISOString() });
beforeEach(async () => { localStorage.clear(); vi.mocked(invokeTauriCommand).mockReset(); useToolsStore.setState({ gscClientId: '', gscProperty: '' }); await i18n.changeLanguage('en'); });
afterEach(cleanup);

it('persists bounded per-page series and rejects corrupt storage', () => {
  expect(loadPageSeries('p')).toEqual({});
  const base = series('s', () => 1);
  Array.from({ length: MAX_SAVED_PAGES + 2 }, (_, i) => i).forEach((i) => savePageSeries('p', `https://a.test/${i}`, { ...base, fetchedAt: new Date(NOW.getTime() + i * 1000).toISOString() }));
  const saved = loadPageSeries('p');
  expect(Object.keys(saved)).toHaveLength(MAX_SAVED_PAGES);
  expect(saved['https://a.test/0']).toBeUndefined();
  localStorage.setItem(pageSeriesKey('p'), '{"x":1}');
  expect(loadPageSeries('p')).toEqual({});
});

it('parses the native payload, sorts days and builds the window from an injected clock', async () => {
  const raw = { rows: [{ keys: ['2026-03-02'], clicks: 3 }, { keys: ['2026-03-01'], clicks: 2 }] };
  expect(parsePageDaily(raw, 's', NOW)).toEqual({ site: 's', fetchedAt: NOW.toISOString(), daily: [{ date: '2026-03-01', clicks: 2 }, { date: '2026-03-02', clicks: 3 }] });
  expect(parsePageDaily({ rows: [{ keys: ['x'], clicks: 1 }] }, 's', NOW)).toBeNull();
  expect(pageWindow('2026-03-18', NOW)).toEqual({ startDate: '2025-12-18', endDate: '2026-05-29' });
  expect(pageWindow('2026-05-20', NOW).endDate).toBe('2026-05-29');
  const invoke = vi.fn().mockResolvedValue(raw);
  const got = await fetchPageSeries({ projectId: 'p', clientId: 'c', siteUrl: 's', pageUrl: URL_A, interventionDate: '2026-03-18' }, NOW, invoke);
  expect(invoke).toHaveBeenCalledWith('search_console_page_daily', expect.objectContaining({ pageUrl: URL_A, startDate: '2025-12-18' }));
  expect(got?.daily).toHaveLength(2);
});

it('estimates a page lift against the best pre-period control page and states contamination', () => {
  const base = (date: string, i: number) => 120 + WEEK[weekday(date)] + wiggle(i);
  const lifted = series('s', (date, i) => base(date, i) + (date >= '2026-03-18' ? 25 : 0));
  const other = series('s', (date, i) => base(date, i) / 2);
  const result = causalPageFor(intervention(URL_A), { [URL_A]: lifted, [URL_B]: other });
  expect(result).toMatchObject({ testSite: URL_A, controlSite: URL_B, estimate: null, unavailable: null });
  expect(result.structural!.status).toBe('estimated');
  expect(result.structural!.absolute!.lower).toBeGreaterThan(0);
  expect(causalPageFor(intervention(URL_A), { [URL_A]: lifted }).controlSite).toBeNull();
  expect(causalPageFor(intervention(URL_A), {})).toMatchObject({ unavailable: 'no-test-series' });
  const tie = causalPageFor(intervention(URL_A), { [URL_A]: lifted, 'https://a.test/z': other, 'https://a.test/y': other });
  expect(tie.controlSite).toBe('https://a.test/y');
  const flatControl = causalPageFor(intervention(URL_A), { [URL_A]: lifted, [URL_B]: series('s', () => 5) });
  expect(flatControl.controlSite).toBe(URL_B);
  const gappy = series('s', (date) => 50 + WEEK[weekday(date)]);
  const holes = causalPageFor(intervention(URL_A), { [URL_A]: lifted, [URL_B]: { ...gappy, daily: gappy.daily.filter((_, i) => i % 4 !== 0) } });
  expect(holes.controlSite).toBe(URL_B);
  const empty = causalPageFor(intervention(URL_A), { [URL_A]: { ...lifted, daily: [] } });
  expect(empty.structural!.status).toBe('not-estimable');
});

it('structural section shows reasons for not-estimable and the contamination note only for pages', () => {
  const none = estimateStructuralImpact({ dates: days.slice(0, 5), test: [1, 2, 3, 4, 5], control: null, interventionDate: days[3] });
  const { rerender } = render(<StructuralImpactSection estimate={none} pageLevel={false} />);
  expect(screen.getByText(/Seasonal structural estimate/u)).toBeTruthy();
  expect(screen.queryByText(/may share links/u)).toBeNull();
  rerender(<StructuralImpactSection estimate={none} pageLevel />);
  expect(screen.getByText(/may share links/u)).toBeTruthy();
  const flat = estimateStructuralImpact({ dates: days, test: days.map((date, i) => 100 + WEEK[weekday(date)] + wiggle(i) + (date >= '2026-03-18' ? 30 : 0)), control: null, interventionDate: '2026-03-18' });
  rerender(<StructuralImpactSection estimate={flat} pageLevel={false} />);
  expect(screen.getByText(/Cumulative effect/iu)).toBeTruthy();
});

it('loader saves the fetched series, reports failures and is disabled without a connection', async () => {
  const onLoaded = vi.fn();
  const { rerender } = render(<PageSeriesLoader projectId="p" intervention={intervention(URL_A)} clientId="" siteUrl="" onLoaded={onLoaded} now={() => NOW} />);
  expect((screen.getByRole('button', { name: 'Load daily series of this page' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Connect a Search Console property/u)).toBeTruthy();
  rerender(<PageSeriesLoader projectId="p" intervention={intervention(URL_A)} clientId="c" siteUrl="https://a.test/" onLoaded={onLoaded} now={() => NOW} />);
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce({ rows: [{ keys: ['2026-03-01'], clicks: 2 }] });
  fireEvent.click(screen.getByRole('button', { name: 'Load daily series of this page' }));
  await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
  expect(loadPageSeries('p')[URL_A].daily).toHaveLength(1);
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce({ rows: 'bad' });
  fireEvent.click(screen.getByRole('button', { name: 'Load daily series of this page' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Load daily series of this page' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  const realClock = render(<PageSeriesLoader projectId="p2" intervention={intervention(URL_A)} clientId="c" siteUrl="s" onLoaded={onLoaded} />);
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce({ rows: [] });
  fireEvent.click(realClock.getAllByRole('button', { name: 'Load daily series of this page' })[0]);
  await waitFor(() => expect(invokeTauriCommand).toHaveBeenCalled());
});

it('card shows a supplied loader instead of the regression section, and the regression section otherwise', () => {
  const evaluation = { status: 'pending', reasons: [], baseline: null, followUp: null, change: null, restOfSite: null, relativeVsSite: null, limitations: [] } as never;
  const causal = { testSite: null, controlSite: null, estimate: null, unavailable: 'no-test-series' } as const;
  const view = render(<ExperimentCard intervention={intervention(URL_A)} evaluation={evaluation} onRemove={() => undefined} pageLoader={<p>LOADER</p>} />);
  expect(screen.getByText('LOADER')).toBeTruthy();
  view.rerender(<ExperimentCard intervention={intervention('site')} evaluation={evaluation} causal={causal} onRemove={() => undefined} />);
  expect(screen.queryByText('LOADER')).toBeNull();
  expect(screen.getByTestId('causal-impact')).toBeTruthy();
});

it('panel wires saved page series and the Search Console settings into page interventions', async () => {
  addIntervention('p', { url: URL_A, date: '2026-03-18', kind: 'content', note: '' }, NOW);
  useToolsStore.setState({ gscClientId: 'client', gscProperty: 'https://a.test/' });
  render(<ExperimentsPanel projectId="p" pages={[{ url: URL_A }] as CrawledPageSummary[]} />);
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce({ rows: days.map((date, i) => ({ keys: [date], clicks: 100 + WEEK[weekday(date)] + wiggle(i) + (date >= '2026-03-18' ? 30 : 0) })) });
  fireEvent.click(screen.getByRole('button', { name: 'Load daily series of this page' }));
  await waitFor(() => expect(screen.getByTestId('structural-impact')).toBeTruthy());
});
