import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import type { GscPerformanceData } from '@/types';
import i18n from '@/i18n';

const acts = {
  resumeGsc: vi.fn(), connectGsc: vi.fn(), refreshGscData: vi.fn(),
  inspectGscUrl: vi.fn(), setGscFilters: vi.fn(),
};
const ev = { preventDefault: vi.fn() } as unknown as FormEvent;
const data = (clicks = 10, site = 'sc-domain:a.test'): GscPerformanceData => ({
  site_url: site, start_date: '2026-09-01', end_date: '2026-09-28', total_clicks: clicks,
  total_impressions: 1000, avg_ctr: 0.01, avg_position: 8,
  queries: [{ query: 'seo', clicks, impressions: 500, ctr: 0.02, position: 9 }],
  pages: [{ page: 'https://a.test/', clicks, impressions: 500, ctr: 0.02, position: 9 }],
  daily: [{ date: '2026-09-01', clicks, impressions: 1000, ctr: 0.01, position: 8 }],
  queries_may_be_truncated: false, pages_may_be_truncated: false, daily_may_be_truncated: false,
  max_rows_per_dimension: 25000,
});

describe('useSearchConsoleSession', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    Object.values(acts).forEach((f) => f.mockReset());
    ev.preventDefault = vi.fn();
    useProjectStore.setState({ activeProjectId: 'p1' });
    useToolsStore.setState({
      ...acts, gscClientId: '', gscClientSecret: '', isGscConnected: false,
      gscProperty: 'sc-domain:a.test', gscData: null, gscFilters: {},
    } as never);
  });

  it('mirrors stored client credentials and resumes an unconnected session', () => {
    useToolsStore.setState({ gscClientId: 'cid', gscClientSecret: 'sec' } as never);
    const { result } = renderHook(() => useSearchConsoleSession());
    expect(result.current.inputClientId).toBe('cid');
    expect(result.current.inputClientSecret).toBe('sec');
    expect(acts.resumeGsc).toHaveBeenCalledTimes(1);
  });

  it('does not resume when connected or without a client id', () => {
    useToolsStore.setState({ gscClientId: 'cid', isGscConnected: true } as never);
    renderHook(() => useSearchConsoleSession());
    expect(acts.resumeGsc).not.toHaveBeenCalled();
  });

  it('connect trims credentials and ignores blank client ids', () => {
    const { result } = renderHook(() => useSearchConsoleSession());
    act(() => result.current.handleConnect(ev));
    expect(acts.connectGsc).not.toHaveBeenCalled();
    act(() => { result.current.setInputClientId('  id '); result.current.setInputClientSecret(' s '); });
    act(() => result.current.handleConnect(ev));
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(acts.connectGsc).toHaveBeenCalledWith('id', 's');
  });

  it('inspects only non-blank URLs and clears the field on project change', () => {
    const { result } = renderHook(() => useSearchConsoleSession());
    act(() => result.current.handleInspect(ev));
    expect(acts.inspectGscUrl).not.toHaveBeenCalled();
    act(() => result.current.setInspectUrl('https://a.test/x'));
    act(() => result.current.handleInspect(ev));
    expect(acts.inspectGscUrl).toHaveBeenCalledWith('https://a.test/x');
    act(() => result.current.setTrackerMessage('hello'));
    act(() => useProjectStore.setState({ activeProjectId: 'p2' }));
    expect(result.current.inspectUrl).toBe('');
    expect(result.current.trackerMessage).toBe('');
  });

  it('refreshes with current range and filters unless the range is invalid', () => {
    useToolsStore.setState({ gscFilters: { device: 'MOBILE' } } as never);
    const { result } = renderHook(() => useSearchConsoleSession());
    act(() => result.current.handleRefresh());
    expect(acts.refreshGscData).toHaveBeenCalledWith(result.current.dateRange, { device: 'MOBILE' });
    acts.refreshGscData.mockClear();
    act(() => result.current.setDateRange({ startDate: 'bad', endDate: 'bad' }));
    expect(result.current.dateRangeError).toBeTruthy();
    act(() => result.current.handleRefresh());
    expect(acts.refreshGscData).not.toHaveBeenCalled();
  });

  it('merges filter patches into the stored filters', () => {
    useToolsStore.setState({ gscFilters: { device: 'MOBILE' } } as never);
    const { result } = renderHook(() => useSearchConsoleSession());
    act(() => result.current.updateFilter({ country: 'pl' }));
    expect(acts.setGscFilters).toHaveBeenCalledWith({ device: 'MOBILE', country: 'pl' });
  });

  it('labels snapshot scope by filters or full scope', () => {
    const { result } = renderHook(() => useSearchConsoleSession());
    expect(result.current.snapshotScopeLabel()).toBe(` · ${i18n.t('searchConsole.fullScope')}`);
    expect(result.current.snapshotScopeLabel({ search_type: 'web', device: 'MOBILE', country: 'pl' }))
      .toBe(' · web · MOBILE · PL');
  });
});
