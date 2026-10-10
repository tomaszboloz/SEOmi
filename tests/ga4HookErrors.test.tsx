import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGa4Session } from '@/components/AgentWorkflows/searchConsole/ga4/useGa4Session';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/services/tauri', () => ({ invokeTauriCommand: invoke }));
const property = { name: 'properties/123', display_name: 'Site', stream_urls: ['https://site.test/'] };
const discovery = { status: 'complete', property, account_pages: 1, stream_pages: 1, candidates_checked: 1, may_be_truncated: false };
const report = (startDate = '2026-09-01', endDate = '2026-09-30', status = 'complete') => ({ status, property: 'properties/123', start_date: startDate, end_date: endDate, rows: [{ host_name: 'site.test', landing_page: '/home', sessions: 2, engaged_sessions: 1, key_events: 0 }], row_count: 1, pages: 1, may_be_truncated: status === 'partial' });
const snapshot = (startDate = '2026-09-01', endDate = '2026-09-30', status = 'complete', nextReport: unknown = report(startDate, endDate, status)) => ({ status, start_date: startDate, end_date: endDate, discovery, report: nextReport });
const session = (activeProjectId: string | null = 'p1', startDate = '2026-09-01', endDate = '2026-09-30', gscClientId = 'client'): SearchConsoleSession => ({ activeProjectId, gscClientId, gscData: null, dateRange: { startDate, endDate } } as SearchConsoleSession);
type Props = { session: SearchConsoleSession; projectRootUrl?: string };
const view = (props: Props) => renderHook(({ session: current, projectRootUrl }) => useGa4Session({ session: current, projectRootUrl }), { initialProps: props });
const idle = (result: ReturnType<typeof view>['result']) => waitFor(() => expect(result.current.loading).toBe('idle'));

describe('useGa4Session errors and stale requests', () => {
  beforeEach(() => { invoke.mockReset(); });

  it('reports missing project, credentials, URL and invalid date ranges without IPC', async () => {
    const hook = view({ session: session(null), projectRootUrl: undefined });
    await act(async () => { await hook.result.current.refreshProperties(); });
    expect(hook.result.current.error).toContain('active project');
    hook.rerender({ session: session('p1', '2026-09-01', '2026-09-30', ''), projectRootUrl: 'https://site.test/' });
    await act(async () => { await hook.result.current.connectAnalytics(); });
    expect(hook.result.current.error).toContain('Search Console');
    hook.rerender({ session: session(), projectRootUrl: undefined });
    await act(async () => { await hook.result.current.refreshProperties(); });
    expect(hook.result.current.error).toContain('active project');
    expect(invoke).not.toHaveBeenCalled();
    hook.unmount();
    const invalid = view({ session: session('p1', '2026-10-01', '2026-09-01'), projectRootUrl: 'https://site.test/' });
    invoke.mockResolvedValue(discovery);
    await act(async () => { await invalid.result.current.refreshProperties(); });
    await act(async () => { await invalid.result.current.loadReport(); });
    expect(invalid.result.current.error).toContain('date range');
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('keeps connection and report failures visible', async () => {
    const hook = view({ session: session(), projectRootUrl: 'https://site.test/' });
    invoke.mockRejectedValueOnce(new Error('connect failed'));
    await act(async () => { await hook.result.current.connectAnalytics(); });
    expect(hook.result.current.error).toBe('connect failed');
    invoke.mockRejectedValueOnce(new Error('list failed'));
    await act(async () => { await hook.result.current.refreshProperties(); });
    expect(hook.result.current.error).toBe('list failed');
    invoke.mockResolvedValueOnce(discovery).mockRejectedValueOnce(new Error('report failed'));
    await act(async () => { await hook.result.current.refreshProperties(); });
    await act(async () => { await hook.result.current.loadReport(); });
    expect(hook.result.current.error).toBe('report failed');
    await idle(hook.result);
  });

  it('handles no match, missing reports, and partial truncated reports', async () => {
    let listed: unknown = { ...discovery, property: { ...property, stream_urls: ['https://other.test/'] } };
    let returned: unknown = snapshot('2026-09-01', '2026-09-30', 'missing', null);
    invoke.mockImplementation((command: string) => command === 'list_google_analytics_properties' ? listed : returned);
    const hook = view({ session: session(), projectRootUrl: 'https://site.test/' });
    await act(async () => { await hook.result.current.refreshProperties(); });
    expect(hook.result.current.matchedProperties).toEqual([]);
    await act(async () => { await hook.result.current.loadReport(); });
    expect(hook.result.current.error).toContain('matches');
    listed = discovery;
    await act(async () => { await hook.result.current.refreshProperties(); });
    await act(async () => { await hook.result.current.loadReport(); });
    expect(hook.result.current.report).toBeNull();
    returned = snapshot('2026-09-01', '2026-09-30', 'partial');
    await act(async () => { await hook.result.current.loadReport(); });
    expect(hook.result.current.report).toMatchObject({ status: 'partial', may_be_truncated: true });
    expect(hook.result.current.joined).toBeTruthy();
  });

  it('ignores stale listing successes and rejections after a project switch', async () => {
    let resolve!: (value: unknown) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise((done, fail) => { resolve = done; reject = fail; });
    invoke.mockReturnValue(pending);
    const hook = view({ session: session('p1'), projectRootUrl: 'https://site.test/' });
    act(() => { void hook.result.current.refreshProperties(); });
    hook.rerender({ session: session('p2'), projectRootUrl: 'https://site.test/' });
    resolve(discovery);
    await idle(hook.result);
    expect(hook.result.current.discovery).toBeNull();
    const second = new Promise((_, fail) => { reject = fail; });
    invoke.mockReturnValue(second);
    act(() => { void hook.result.current.refreshProperties(); });
    hook.rerender({ session: session('p3'), projectRootUrl: 'https://site.test/' });
    reject(new Error('late list failure'));
    await idle(hook.result);
    expect(hook.result.current.error).toBeNull();
  });

  it('ignores stale report success and rejection after a date change', async () => {
    let settle!: (value: unknown) => void;
    let fail!: (error: Error) => void;
    const pending = new Promise((resolve) => { settle = resolve; });
    invoke.mockImplementation((command: string) => command === 'list_google_analytics_properties' ? discovery : pending);
    const hook = view({ session: session(), projectRootUrl: 'https://site.test/' });
    await act(async () => { await hook.result.current.refreshProperties(); });
    act(() => { void hook.result.current.loadReport(); });
    hook.rerender({ session: session('p1', '2026-10-01', '2026-10-30'), projectRootUrl: 'https://site.test/' });
    settle(snapshot('2026-09-01', '2026-09-30'));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.report).toBeNull();
    const rejected = new Promise((_, reject) => { fail = reject; });
    invoke.mockReturnValue(rejected);
    act(() => { void hook.result.current.loadReport(); });
    hook.rerender({ session: session('p1', '2026-11-01', '2026-11-30'), projectRootUrl: 'https://site.test/' });
    fail(new Error('late report failure'));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.error).toBeNull();
  });
});
