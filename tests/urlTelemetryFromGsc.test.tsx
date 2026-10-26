import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { ProtectionPanel } from '@/components/Domain/crawlResults/focus/ProtectionPanel';
import { saveGscSnapshot } from '@/services/gscTracker/persistence';
import type { SiteFocusReport } from '@/services/siteFocus';
import { clearSnapshots, ensureUrlTelemetry, getSnapshot, latestSnapshot, performanceDataOf } from '@/services/urlTelemetry';
import type { GscPerformanceData } from '@/types';

const NOW = new Date('2026-10-24T08:00:00Z');
const URLS = ['https://a.test/', 'https://a.test/low'];

const data = (end: string, clicks: number, extra: Partial<GscPerformanceData> = {}): GscPerformanceData => ({
  site_url: 'sc-domain:a.test', start_date: '2026-07-01', end_date: end, total_clicks: clicks, total_impressions: clicks * 10, avg_ctr: 0.1, avg_position: 5,
  queries: [], pages: [{ page: 'https://a.test/low', clicks, impressions: clicks * 10, ctr: 0.1, position: 5 }],
  daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 1000, ...extra,
} as GscPerformanceData);

beforeEach(async () => { localStorage.clear(); clearSnapshots(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('urlTelemetry from saved Search Console snapshots', () => {
  it('builds nothing without a saved snapshot, a root URL, and never zero-fills', () => {
    expect(ensureUrlTelemetry('p1', URLS, NOW)).toBeNull();
    saveGscSnapshot('p1', data('2026-10-23', 40));
    expect(ensureUrlTelemetry('p1', [], NOW)).toBeNull();
    expect(ensureUrlTelemetry('p1', ['not a URL'], NOW)).toBeNull();
    expect(getSnapshot('p1', NOW)).toBeNull();
  });

  it('builds from the newest period, measures matching pages and keeps GA4 and backlinks unavailable', () => {
    saveGscSnapshot('p1', data('2026-09-30', 5), undefined, '2026-10-01T00:00:00Z');
    saveGscSnapshot('p1', data('2026-10-23', 40), undefined, '2026-10-24T00:00:00Z');
    const snapshot = ensureUrlTelemetry('p1', URLS, NOW)!;
    const low = snapshot.urls.find((row) => row.url.endsWith('/low'))!;
    expect(low.gsc.state).not.toBe('unavailable');
    expect(low.gsc.value?.clicks).toBe(40);
    expect(snapshot.sources.gsc.property).toBe('sc-domain:a.test');
    expect(snapshot.sources.ga4.state).toBe('unavailable');
    expect(snapshot.sources.backlinks.state).toBe('unavailable');
    // The page list is complete (not truncated), so a crawled URL without a row is a measured zero.
    expect(snapshot.urls.find((row) => row.url === 'https://a.test/')?.gsc).toMatchObject({ state: 'measured', value: { clicks: 0 } });
  });

  it('caches per project until expiry and rebuilds afterwards', () => {
    saveGscSnapshot('p1', data('2026-10-23', 40));
    const first = ensureUrlTelemetry('p1', URLS, NOW)!;
    expect(ensureUrlTelemetry('p1', URLS, NOW)).toBe(first);
    const later = new Date(NOW.getTime() + 2 * 86_400_000);
    expect(ensureUrlTelemetry('p1', URLS, later)).not.toBe(first);
    expect(ensureUrlTelemetry('p2', URLS, NOW)).toBeNull();
  });

  it('maps a stored snapshot back to performance data with unknown daily history', () => {
    const { snapshot } = saveGscSnapshot('p1', data('2026-10-23', 40, { filters: { search_type: 'web' } as never, query_pages: [{ query: 'q', page: 'https://a.test/low', clicks: 1, impressions: 2, ctr: 0.5, position: 3 }] }));
    delete snapshot.daily;
    delete snapshot.daily_may_be_truncated;
    const restored = performanceDataOf(snapshot);
    expect(restored.daily).toEqual([]);
    expect(restored.daily_may_be_truncated).toBe(true);
    expect(restored.filters).toEqual(snapshot.filters);
    expect(restored.query_pages).toHaveLength(1);
    expect('filters' in performanceDataOf({ ...snapshot, filters: undefined })).toBe(false);
    expect('query_pages' in performanceDataOf({ ...snapshot, query_pages: undefined })).toBe(false);
  });

  it('orders snapshots by period end, then capture time', () => {
    const a = saveGscSnapshot('p1', data('2026-10-01', 1), undefined, '2026-10-02T00:00:00Z').snapshot;
    const b = saveGscSnapshot('p1', data('2026-10-23', 2), undefined, '2026-10-24T00:00:00Z').snapshot;
    expect(latestSnapshot([a, b])).toBe(b);
    expect(latestSnapshot([b, { ...b, id: 'later', captured_at: '2026-10-25T00:00:00Z' }])?.id).toBe('later');
    expect(latestSnapshot([])).toBeUndefined();
  });
});

describe('ProtectionPanel with saved Search Console data', () => {
  const report = { pages: [{ url: 'https://a.test/low', trs: 10 }] } as unknown as SiteFocusReport;

  it('uses the saved data instead of the empty state', () => {
    saveGscSnapshot('p1', data('2026-10-23', 400));
    render(<ProtectionPanel report={report} projectId="p1" />);
    expect(screen.queryByTestId('protection-empty')).toBeNull();
    expect(screen.getByTestId('protection-panel').textContent).toContain('https://a.test/low');
  });

  it('keeps the empty state when nothing was saved', () => {
    render(<ProtectionPanel report={report} projectId="p1" />);
    expect(screen.getByTestId('protection-empty')).toBeTruthy();
  });
});
