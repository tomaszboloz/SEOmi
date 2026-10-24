import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGa4Session } from '@/components/AgentWorkflows/searchConsole/ga4/useGa4Session';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { saveGscSnapshot } from '@/services/gscTracker/persistence';
import { clearSnapshots, dropSnapshot, ensureUrlTelemetry, forgetGa4Reports, getSnapshot, putSnapshot, recallGa4Report, rememberGa4Report } from '@/services/urlTelemetry';
import type { GscPerformanceData } from '@/types';
import type { Ga4Report } from '@/types/ga4';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: invoke }));

const NOW = new Date('2026-10-24T08:00:00Z');
const URLS = ['https://a.test/', 'https://a.test/low'];
const report = (sessions: number): Ga4Report => ({
  status: 'complete', property: 'properties/1', start_date: '2026-07-01', end_date: '2026-10-23', may_be_truncated: false, row_count: 1,
  rows: [{ host_name: 'a.test', landing_page: '/low', sessions, engaged_sessions: sessions - 1, key_events: 2 }],
} as Ga4Report);
const gsc = (): GscPerformanceData => ({
  site_url: 'sc-domain:a.test', start_date: '2026-07-01', end_date: '2026-10-23', total_clicks: 5, total_impressions: 50, avg_ctr: 0.1, avg_position: 5,
  queries: [], pages: [{ page: 'https://a.test/low', clicks: 5, impressions: 50, ctr: 0.1, position: 5 }],
  daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 1000,
} as GscPerformanceData);

beforeEach(() => { localStorage.clear(); clearSnapshots(); forgetGa4Reports(); invoke.mockReset(); });
afterEach(() => { clearSnapshots(); forgetGa4Reports(); });

describe('session cache of the last GA4 report', () => {
  it('remembers per project, forgets all, and drops only the matching shared snapshot', () => {
    expect(recallGa4Report('p1')).toBeNull();
    saveGscSnapshot('p1', gsc());
    saveGscSnapshot('p2', gsc());
    const one = ensureUrlTelemetry('p1', URLS, NOW)!;
    const two = ensureUrlTelemetry('p2', URLS, NOW)!;
    rememberGa4Report('p1', report(10));
    expect(recallGa4Report('p1')?.rows[0].sessions).toBe(10);
    expect(recallGa4Report('p2')).toBeNull();
    expect(getSnapshot('p1', NOW)).toBeNull();
    expect(getSnapshot('p2', NOW)).toBe(two);
    expect(one).not.toBe(getSnapshot('p1', NOW));
    forgetGa4Reports();
    expect(recallGa4Report('p1')).toBeNull();
    dropSnapshot('missing');
  });
});

describe('telemetry with GA4', () => {
  it('keeps GA4 unavailable until a report exists, then measures landing pages and marks the source', () => {
    saveGscSnapshot('p1', gsc());
    const before = ensureUrlTelemetry('p1', URLS, NOW)!;
    expect(before.sources.ga4.state).toBe('unavailable');
    expect(before.urls.find((row) => row.url.endsWith('/low'))?.ga4.value).toBeNull();
    rememberGa4Report('p1', report(12));
    const after = ensureUrlTelemetry('p1', URLS, NOW)!;
    expect(after).not.toBe(before);
    expect(after.sources.ga4).toMatchObject({ property: 'properties/1', state: 'measured' });
    expect(after.urls.find((row) => row.url.endsWith('/low'))?.ga4.value).toEqual({ sessions: 12, engagedSessions: 11, keyEvents: 2 });
    expect(ensureUrlTelemetry('p1', URLS, NOW)).toBe(after);
  });

  it('does not create telemetry from GA4 alone', () => {
    rememberGa4Report('p1', report(3));
    expect(ensureUrlTelemetry('p1', URLS, NOW)).toBeNull();
    putSnapshot(ensureUrlTelemetry('p1', URLS, NOW) ?? ({ projectId: 'x', expiresAt: '2099-01-01T00:00:00Z' } as never));
    expect(getSnapshot('x', NOW)).not.toBeNull();
  });
});

describe('useGa4Session feeds the cache', () => {
  const property = { name: 'properties/1', display_name: 'Site', stream_urls: ['https://site.test/'] };
  const discovery = { status: 'complete', property, account_pages: 1, stream_pages: 1, candidates_checked: 1, may_be_truncated: false };
  const session = { activeProjectId: 'p1', gscClientId: 'client', gscData: null, dateRange: { startDate: '2026-09-01', endDate: '2026-09-30' } } as unknown as SearchConsoleSession;

  it('remembers a loaded report for the active project and ignores an empty result', async () => {
    const snapshot = { status: 'complete', start_date: '2026-09-01', end_date: '2026-09-30', discovery, report: { ...report(8), start_date: '2026-09-01', end_date: '2026-09-30', rows: [], row_count: 0 } };
    invoke.mockImplementation((command: string) => (command === 'list_google_analytics_properties' ? discovery : snapshot));
    const hook = renderHook(() => useGa4Session({ session, projectRootUrl: 'https://site.test/' }));
    await act(async () => { await hook.result.current.refreshProperties(); });
    await act(async () => { await hook.result.current.loadReport(); });
    expect(recallGa4Report('p1')?.property).toBe('properties/1');
    forgetGa4Reports();
    invoke.mockImplementation((command: string) => (command === 'list_google_analytics_properties' ? discovery : { ...snapshot, report: null }));
    await act(async () => { await hook.result.current.loadReport(); });
    expect(recallGa4Report('p1')).toBeNull();
  });
});
