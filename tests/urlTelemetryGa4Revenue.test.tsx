import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { RevenueImport } from '@/components/Domain/crawlResults/focus/RevenueImport';
import { ConnectedProtectionPanel as ProtectionPanel } from '@/components/Domain/crawlResults/focus/ConnectedProtectionPanel';
import type { SiteFocusReport } from '@/services/siteFocus';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { fetchGa4Revenue } from '@/services/ga4/revenueFetch';
import { defaultRevenueRange, ga4RevenueToImport, recallRevenueImport } from '@/services/urlTelemetry';
import { invokeTauriCommand } from '@/services/tauri';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
const NOW = new Date('2026-10-24T08:00:00Z');
const payload = (patch: Record<string, unknown> = {}) => ({
  status: 'complete', property: 'properties/9', start_date: '2026-07-26', end_date: '2026-10-23', currency_code: 'PLN',
  attribution: 'ga4-session-landing-page', may_be_truncated: false, rows: [{ landing_page: '/a', revenue: 10.5 }, { landing_page: '/b', revenue: 0 }], ...patch,
});
beforeEach(async () => { localStorage.clear(); vi.mocked(invokeTauriCommand).mockReset(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

it('maps the native payload, keeping the currency GA4 reported and flagging truncation', () => {
  expect(ga4RevenueToImport(payload(), NOW)).toEqual({
    provider: 'ga4-api', attribution: 'ga4-session-landing-page', currency: 'PLN', organicOnly: true,
    period: { start: '2026-07-26', end: '2026-10-23' }, sourceFile: 'GA4 API properties/9', importedAt: NOW.toISOString(), truncated: false,
    rows: [{ landingPage: '/a', revenue: 10.5 }, { landingPage: '/b', revenue: 0 }],
  });
  expect(ga4RevenueToImport(payload({ may_be_truncated: true }), NOW)).toMatchObject({ truncated: true });
  expect(ga4RevenueToImport(payload({ start_date: '2026-10-24', end_date: '2026-10-23' }), NOW)).toMatchObject({ period: null });
  const many = Array.from({ length: 5001 }, (_, i) => ({ landing_page: `/p${i}`, revenue: 1 }));
  const big = ga4RevenueToImport(payload({ rows: many }), NOW);
  expect(big).toMatchObject({ truncated: true });
  expect(typeof big !== 'string' && big.rows).toHaveLength(5000);
  expect(ga4RevenueToImport(payload({ rows: [] }), NOW)).toBe('no-rows');
  for (const bad of [null, payload({ currency_code: 'pln' }), payload({ rows: [{ landing_page: '/a', revenue: -1 }] }), payload({ attribution: 'other' })]) {
    expect(ga4RevenueToImport(bad, NOW)).toBe('invalid-response');
  }
});

it('computes the default window from an injected clock', () => {
  expect(defaultRevenueRange(NOW)).toEqual({ startDate: '2026-07-26', endDate: '2026-10-23' });
});

it('calls the desktop command with the window and returns the import', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(payload());
  const result = await fetchGa4Revenue({ projectId: 'p', clientId: 'c', siteUrl: 'https://a.test', startDate: '2026-07-26', endDate: '2026-10-23' }, NOW);
  expect(invokeTauriCommand).toHaveBeenCalledWith('google_analytics_revenue', expect.objectContaining({ projectId: 'p', siteUrl: 'https://a.test' }));
  expect(result).toMatchObject({ provider: 'ga4-api' });
  const viaDefault = vi.fn().mockResolvedValue(payload({ rows: [] }));
  expect(await fetchGa4Revenue({ projectId: 'p', clientId: 'c', siteUrl: 's', startDate: 'a', endDate: 'b' }, undefined, viaDefault)).toBe('no-rows');
});

it('panel fetches through the API, saves, and reports failures; the button needs a connection', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<RevenueImport projectId="p" onChange={onChange} />);
  expect(screen.queryByRole('button', { name: 'Fetch from GA4 API' })).toBeNull();
  rerender(<RevenueImport projectId="p" onChange={onChange} ga4={{ clientId: 'c', siteUrl: 'https://a.test' }} now={() => NOW} />);
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce(payload());
  fireEvent.click(screen.getByRole('button', { name: 'Fetch from GA4 API' }));
  await waitFor(() => expect(recallRevenueImport('p')).toMatchObject({ provider: 'ga4-api', currency: 'PLN' }));
  expect(onChange).toHaveBeenCalled();
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce(payload({ rows: [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Fetch from GA4 API' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('no landing page'));
  vi.mocked(invokeTauriCommand).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Fetch from GA4 API' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not be fetched'));
});

it('panel works with the real clock default', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(payload({ rows: [] }));
  render(<RevenueImport projectId="q" onChange={() => undefined} ga4={{ clientId: 'c', siteUrl: 'https://a.test' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Fetch from GA4 API' }));
  await waitFor(() => expect(invokeTauriCommand).toHaveBeenCalled());
});

it('protection panel offers the API fetch only with a client ID and a project URL', () => {
  const report = { pages: [{ url: 'https://a.test/x', trs: 10 }] } as unknown as SiteFocusReport;
  const project = { id: 'p', name: 'A', rootUrl: 'https://a.test', createdAt: '', lastOpenedAt: '' };
  useProjectStore.setState({ projects: [project], activeProjectId: 'p' });
  useToolsStore.setState({ gscClientId: ' ' });
  const view = render(<ProtectionPanel report={report} projectId="p" />);
  expect(screen.queryByRole('button', { name: 'Fetch from GA4 API' })).toBeNull();
  useToolsStore.setState({ gscClientId: 'client' });
  view.rerender(<ProtectionPanel report={report} projectId="p" />);
  expect(screen.getByRole('button', { name: 'Fetch from GA4 API' })).toBeTruthy();
  view.rerender(<ProtectionPanel report={report} projectId="unknown" />);
  expect(screen.queryByRole('button', { name: 'Fetch from GA4 API' })).toBeNull();
});

it('reports a storage failure instead of a silent success', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(payload());
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  render(<RevenueImport projectId="p" onChange={() => undefined} ga4={{ clientId: 'c', siteUrl: 'https://a.test' }} now={() => NOW} />);
  fireEvent.click(screen.getByRole('button', { name: 'Fetch from GA4 API' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('not saved'));
  spy.mockRestore();
});

it('shows an import without a stated period', () => {
  const saved = ga4RevenueToImport(payload({ start_date: '2026-10-24', end_date: '2026-10-23' }), NOW);
  render(<RevenueImport projectId="r" onChange={() => undefined} />);
  cleanup();
  localStorage.setItem('seomi_project_r_revenue_import_v1', JSON.stringify(saved));
  render(<RevenueImport projectId="r" onChange={() => undefined} />);
  expect(screen.getByText(/not stated in the file/u)).toBeTruthy();
});
