import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { Ga4OutcomeLoader } from '@/components/Charts/experiments/Ga4OutcomeLoader';
import { ExperimentsPanel } from '@/components/Charts/ExperimentsPanel';
import { causalOutcomeFor, fetchGa4Outcomes, landingPath, parseGa4Daily } from '@/services/experiments/ga4Outcome';
import { ga4OutcomeKey, loadGa4Outcomes, loadOutcomeChoice, MAX_GA4_TARGETS, outcomeChoiceKey, saveGa4Outcomes, saveOutcomeChoice, type Ga4Outcomes } from '@/services/experiments/ga4OutcomeStore';
import { addIntervention, type Intervention } from '@/services/experiments/registry';
import { weekday } from '@/services/experiments/structuralModel';
import { invokeTauriCommand } from '@/services/tauri/transport';
import { useToolsStore } from '@/stores/toolsStore';
import type { CrawledPageSummary } from '@/types';

vi.mock('@/services/tauri/transport', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
const NOW = new Date('2026-06-01T00:00:00Z');
const DAY = 86_400_000;
const days = Array.from({ length: 60 }, (_, i) => new Date(Date.parse('2026-02-01T00:00:00Z') + i * DAY).toISOString().slice(0, 10));
const WEEK = [10, 12, 14, 13, 11, -25, -28];
const wiggle = (i: number) => ((i * 7919) % 13) - 6;
const series = (fn: (date: string, i: number) => number, currency = 'PLN'): Ga4Outcomes => ({ property: 'properties/9', currency, fetchedAt: NOW.toISOString(), daily: days.map((date, i) => ({ date, keyEvents: Math.max(0, fn(date, i)), revenue: Math.max(0, fn(date, i)) * 10 })) });
const lift = (date: string, i: number) => 100 + WEEK[weekday(date)] + wiggle(i) + (date >= '2026-03-18' ? 30 : 0);
const raw = (rows = days.map((date, i) => ({ date, key_events: 5 + i, revenue: 50 + i }))) => ({ property: 'properties/9', currency_code: 'EUR', daily: rows });
const intervention = (url: string): Intervention => ({ id: 'i', projectId: 'p', url, date: '2026-03-18', kind: 'content', note: '', createdAt: NOW.toISOString() });
beforeEach(async () => { localStorage.clear(); vi.mocked(invokeTauriCommand).mockReset(); useToolsStore.setState({ gscClientId: '', gscProperty: '' }); await i18n.changeLanguage('en'); });
afterEach(cleanup);

it('persists bounded GA4 outcomes and the chosen outcome, falling back on corrupt data', () => {
  expect(loadGa4Outcomes('p')).toEqual({});
  Array.from({ length: MAX_GA4_TARGETS + 2 }, (_, i) => i).forEach((i) => saveGa4Outcomes('p', `t${i}`, { ...series(lift), fetchedAt: new Date(NOW.getTime() + i * 1000).toISOString() }));
  expect(Object.keys(loadGa4Outcomes('p'))).toHaveLength(MAX_GA4_TARGETS);
  localStorage.setItem(ga4OutcomeKey('p'), '{"x":1}');
  expect(loadGa4Outcomes('p')).toEqual({});
  expect(loadOutcomeChoice('p')).toBe('gsc-clicks');
  saveOutcomeChoice('p', 'ga4-revenue');
  expect(loadOutcomeChoice('p')).toBe('ga4-revenue');
  localStorage.setItem(outcomeChoiceKey('p'), '"nope"');
  expect(loadOutcomeChoice('p')).toBe('gsc-clicks');
});

it('parses the native payload and builds the request from an injected clock', async () => {
  expect(parseGa4Daily(raw(), NOW)).toMatchObject({ property: 'properties/9', currency: 'EUR', fetchedAt: NOW.toISOString() });
  expect(parseGa4Daily(raw([{ date: '2026-03-02', key_events: 1, revenue: 1 }, { date: '2026-03-01', key_events: 2, revenue: 2 }]), NOW)!.daily.map((row) => row.date)).toEqual(['2026-03-01', '2026-03-02']);
  expect(parseGa4Daily(raw([]), NOW)).toBeNull();
  expect(parseGa4Daily({ ...raw(), currency_code: 'eur' }, NOW)).toBeNull();
  expect(landingPath('site')).toBeUndefined();
  expect(landingPath('https://a.test/p?x=1')).toBe('/p?x=1');
  const invoke = vi.fn().mockResolvedValue(raw());
  await fetchGa4Outcomes({ projectId: 'p', clientId: 'c', siteUrl: 's', target: 'https://a.test/p', interventionDate: '2026-03-18' }, NOW, invoke);
  expect(invoke).toHaveBeenCalledWith('google_analytics_daily', expect.objectContaining({ pagePath: '/p', startDate: '2025-12-18' }));
});

it('estimates the outcome lift: site without a control, a page against other pages, never mixing site and pages', () => {
  const site = causalOutcomeFor(intervention('site'), { site: series(lift), 'https://a.test/x': series(lift) }, 'ga4-key-events');
  expect(site).toMatchObject({ testSite: 'site', controlSite: null });
  expect(site.structural!.absolute!.lower).toBeGreaterThan(0);
  const base = (date: string, i: number) => 100 + WEEK[weekday(date)] + wiggle(i);
  const page = causalOutcomeFor(intervention('https://a.test/p'), { site: series(lift), 'https://a.test/p': series(lift), 'https://a.test/q': series((d, i) => base(d, i) / 2) }, 'ga4-revenue');
  expect(page.controlSite).toBe('https://a.test/q');
  expect(page.structural!.status).toBe('estimated');
  expect(causalOutcomeFor(intervention('https://a.test/p'), { site: series(lift) }, 'ga4-revenue')).toMatchObject({ unavailable: 'no-test-series' });
});

it('loader saves the series, shows its currency, reports failures and needs a connection', async () => {
  const onLoaded = vi.fn();
  const { rerender } = render(<Ga4OutcomeLoader projectId="p" intervention={intervention('site')} clientId="" siteUrl="" onLoaded={onLoaded} now={() => NOW} />);
  expect((screen.getByRole('button', { name: 'Load daily GA4 series' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Connect Google Analytics first/u)).toBeTruthy();
  rerender(<Ga4OutcomeLoader projectId="p" intervention={intervention('site')} clientId="c" siteUrl="https://a.test/" saved={series(lift, 'USD')} onLoaded={onLoaded} now={() => NOW} />);
  expect(screen.getByText(/revenue is in USD/u)).toBeTruthy();
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce(raw());
  fireEvent.click(screen.getByRole('button', { name: 'Load daily GA4 series' }));
  await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
  expect(loadGa4Outcomes('p').site.currency).toBe('EUR');
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce({ nope: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Load daily GA4 series' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Load daily GA4 series' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  const real = render(<Ga4OutcomeLoader projectId="q" intervention={intervention('site')} clientId="c" siteUrl="s" onLoaded={onLoaded} />);
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce(raw([]));
  fireEvent.click(real.getAllByRole('button', { name: 'Load daily GA4 series' })[0]);
  await waitFor(() => expect(invokeTauriCommand).toHaveBeenCalled());
});

it('panel switches the outcome, persists the choice and shows the GA4 loader and result', async () => {
  addIntervention('p', { url: 'site', date: '2026-03-18', kind: 'content', note: '' }, NOW);
  useToolsStore.setState({ gscClientId: 'client', gscProperty: 'https://a.test/' });
  render(<ExperimentsPanel projectId="p" pages={[{ url: 'https://a.test/' }] as CrawledPageSummary[]} />);
  expect(screen.queryByRole('button', { name: 'Load daily GA4 series' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Outcome measured'), { target: { value: 'ga4-revenue' } });
  expect(loadOutcomeChoice('p')).toBe('ga4-revenue');
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce(raw(days.map((date, i) => ({ date, key_events: 1, revenue: lift(date, i) }))));
  fireEvent.click(screen.getByRole('button', { name: 'Load daily GA4 series' }));
  await waitFor(() => expect(screen.getByTestId('structural-impact')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Outcome measured'), { target: { value: 'gsc-clicks' } });
  expect(screen.queryByRole('button', { name: 'Load daily GA4 series' })).toBeNull();
});
