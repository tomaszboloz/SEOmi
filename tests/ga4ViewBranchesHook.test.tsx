import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGa4Session } from '@/components/AgentWorkflows/searchConsole/ga4/useGa4Session';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import type { GscPerformanceData } from '@/types';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: invoke }));
const property = { name: 'properties/1', display_name: 'Site', stream_urls: ['https://site.test/'] };
const discovery = { status: 'complete', property, account_pages: 1, stream_pages: 1, candidates_checked: 1, may_be_truncated: false };
const snapshot = { status: 'complete', start_date: '2026-08-01', end_date: '2026-08-31', discovery, report: { status: 'complete', property: 'properties/1', start_date: '2026-08-01', end_date: '2026-08-31', rows: [], row_count: 0, may_be_truncated: false } };
const session = (gscData: SearchConsoleSession['gscData'] = null): SearchConsoleSession => ({ activeProjectId: 'p1', gscClientId: 'client', gscData, dateRange: { startDate: '2026-09-01', endDate: '2026-09-30' } } as SearchConsoleSession);
const gsc = { site_url: 'https://site.test/', start_date: '2026-08-01', end_date: '2026-08-31', total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0, queries: [], pages: [], daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 100 } as GscPerformanceData;

describe('GA4 hook branch coverage', () => {
  it('uses the Search Console period and joins an empty report', async () => {
    invoke.mockImplementation((command: string) => command === 'list_google_analytics_properties' ? discovery : snapshot);
    const hook = renderHook(() => useGa4Session({ session: session(gsc), projectRootUrl: 'https://site.test/' }));
    expect(hook.result.current.dateRange).toEqual({ startDate: '2026-08-01', endDate: '2026-08-31' });
    await act(async () => { await hook.result.current.refreshProperties(); });
    await act(async () => { await hook.result.current.loadReport(); });
    expect(hook.result.current.report?.rows).toEqual([]);
    expect(hook.result.current.joined?.gsc_period_matches).toBe(true);
  });

  it('stringifies a non-Error provider rejection', async () => {
    invoke.mockRejectedValue('plain provider failure');
    const hook = renderHook(() => useGa4Session({ session: session(), projectRootUrl: 'https://site.test/' }));
    await act(async () => { await hook.result.current.refreshProperties(); });
    expect(hook.result.current.error).toBe('plain provider failure');
  });
});
