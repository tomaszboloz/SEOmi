import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { saveGscSnapshot } from '@/services/gscTracker/persistence';
import {
  buildUrlTelemetrySnapshot, clearSnapshots, ensureUrlTelemetry, forgetRevenueImport, getSnapshot, parseGa4RevenueCsv,
  recallRevenueImport, rememberRevenueImport, type RevenueImport,
} from '@/services/urlTelemetry';
import { revenueImportKey } from '@/services/urlTelemetry/revenueStore';
import { decideProtection } from '@/services/urlProtection/decide';
import { ProtectionPanel } from '@/components/Domain/crawlResults/focus/ProtectionPanel';
import type { SiteFocusReport } from '@/services/siteFocus';
import type { GscPerformanceData } from '@/types';

const NOW = new Date('2026-10-24T08:00:00Z');
const CSV = [
  '# ----------------------------------------', '# Landing page report', '# Start date: 20260726', '# End date: 20261023',
  'Landing page + query string,Sessions,"Total revenue"', '/low,10,"1,250.50"', '/low,1,49.50', '/other,3,0', '(not set),2,99', '/bad,1,n/a', '',
].join('\n');
const options = { currency: 'eur', organicOnly: true, sourceFile: 'ga4.csv', now: NOW };
const gsc = (): GscPerformanceData => ({
  site_url: 'sc-domain:a.test', start_date: '2026-07-26', end_date: '2026-10-23', total_clicks: 5, total_impressions: 50, avg_ctr: 0.1, avg_position: 5,
  queries: [], pages: [{ page: 'https://a.test/low', clicks: 5, impressions: 50, ctr: 0.1, position: 5 }],
  daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 1000,
} as GscPerformanceData);
const imported = () => parseGa4RevenueCsv(CSV, options) as RevenueImport;

beforeEach(async () => { localStorage.clear(); clearSnapshots(); await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); clearSnapshots(); });

describe('GA4 revenue export (#91)', () => {
  it('parses landing page revenue with period, stated currency and attribution', () => {
    expect(imported()).toEqual({
      provider: 'ga4-export', attribution: 'ga4-session-landing-page', currency: 'EUR', organicOnly: true,
      period: { start: '2026-07-26', end: '2026-10-23' }, sourceFile: 'ga4.csv', importedAt: NOW.toISOString(), truncated: false,
      rows: [{ landingPage: '/low', revenue: 1300 }, { landingPage: '/other', revenue: 0 }],
    });
    expect(parseGa4RevenueCsv(CSV, { ...options, currency: 'euro' })).toBe('invalid-currency');
    expect(parseGa4RevenueCsv(CSV, { ...options, organicOnly: false })).toBe('not-organic');
    expect(parseGa4RevenueCsv('Page,Sessions\n/a,1', options)).toBe('no-header');
    expect(parseGa4RevenueCsv('Landing page,Revenue\n/a,x', options)).toBe('no-rows');
    expect((parseGa4RevenueCsv('Landing page,Revenue\n/a,1', options) as RevenueImport).period).toBeNull();
    const many = ['Landing page,Revenue', ...Array.from({ length: 5001 }, (_, i) => `/p${i},1`)].join('\n');
    expect((parseGa4RevenueCsv(many, options) as RevenueImport)).toMatchObject({ truncated: true });
  });

  it('measures revenue per URL, keeps unlisted URLs unknown and lets it shield a page', () => {
    const snapshot = buildUrlTelemetrySnapshot({ projectId: 'p', rootUrl: 'https://a.test/', urls: ['https://a.test/low', 'https://a.test/none'], revenue: imported(), now: NOW })!;
    const low = snapshot.urls.find((row) => row.url === 'https://a.test/low')!;
    expect(low.revenue).toEqual({ state: 'measured', value: { amount: 1300, currency: 'EUR' } });
    expect(snapshot.urls.find((row) => row.url === 'https://a.test/other')!.revenue.value).toEqual({ amount: 0, currency: 'EUR' });
    expect(snapshot.urls.find((row) => row.url === 'https://a.test/none')!.revenue).toEqual({ state: 'unavailable', value: null, note: 'landing page not in the revenue export' });
    expect(snapshot.sources.revenue).toMatchObject({ state: 'measured', currency: 'EUR', attribution: 'ga4-session-landing-page', period: { days: 90 } });
    expect(decideProtection(10, low).reasons).toContain('revenue');
    const stale = buildUrlTelemetrySnapshot({ projectId: 'p', rootUrl: 'https://a.test/', urls: [], revenue: { ...imported(), truncated: true }, now: NOW })!;
    expect(stale.sources.revenue?.state).toBe('sampled');
    expect(buildUrlTelemetrySnapshot({ projectId: 'p', rootUrl: 'https://a.test/', urls: [], now: NOW })!.sources.revenue).toBeUndefined();
  });

  it('persists per project and invalidates the shared snapshot', () => {
    saveGscSnapshot('p1', gsc());
    ensureUrlTelemetry('p1', ['https://a.test/low'], NOW);
    expect(getSnapshot('p1', NOW)).not.toBeNull();
    expect(rememberRevenueImport('p1', imported())).toBe(true);
    expect(getSnapshot('p1', NOW)).toBeNull();
    expect(recallRevenueImport('p1')?.currency).toBe('EUR');
    expect(recallRevenueImport('p2')).toBeNull();
    expect(ensureUrlTelemetry('p1', ['https://a.test/low'], NOW)?.urls.find((row) => row.url === 'https://a.test/low')?.revenue.state).toBe('measured');
    localStorage.setItem(revenueImportKey('p3'), '{"provider":"x"}');
    expect(recallRevenueImport('p3')).toBeNull();
    forgetRevenueImport('p1');
    expect(recallRevenueImport('p1')).toBeNull();
  });
});

describe('RevenueImport UI', () => {
  const report = { pages: [{ url: 'https://a.test/low', trs: 10 }] } as unknown as SiteFocusReport;
  it('requires currency and organic confirmation, then shows the source', async () => {
    saveGscSnapshot('p1', gsc());
    render(<ProtectionPanel report={report} projectId="p1" />);
    const panel = within(screen.getByTestId('revenue-import'));
    expect(panel.getByText(/No revenue export imported/)).toBeTruthy();
    const file = () => new File([CSV], 'ga4.csv', { type: 'text/csv' });
    fireEvent.change(panel.getByLabelText('GA4 CSV export'), { target: { files: [file()] } });
    await waitFor(() => expect(panel.getByRole('alert').textContent).toMatch(/3-letter ISO code/));
    fireEvent.change(panel.getByLabelText('Currency (ISO code)'), { target: { value: 'pln' } });
    fireEvent.change(panel.getByLabelText('GA4 CSV export'), { target: { files: [file()] } });
    await waitFor(() => expect(panel.getByRole('alert').textContent).toMatch(/organic search sessions/));
    fireEvent.click(panel.getByLabelText('The export contains organic search sessions only'));
    fireEvent.change(panel.getByLabelText('GA4 CSV export'), { target: { files: [file()] } });
    await waitFor(() => expect(panel.getByText(/Imported ga4.csv: 2 landing pages in PLN, period 2026-07-26 – 2026-10-23/)).toBeTruthy());
    const revenue = within(screen.getByTestId('telemetry-source-revenue'));
    expect(revenue.getByText('Currency: PLN')).toBeTruthy();
    expect(revenue.getByText('Attribution: GA4 session landing page')).toBeTruthy();
    fireEvent.click(panel.getByRole('button', { name: 'Remove' }));
    expect(panel.getByText(/No revenue export imported/)).toBeTruthy();
  });
});
