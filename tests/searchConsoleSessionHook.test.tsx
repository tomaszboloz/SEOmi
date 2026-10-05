import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import i18n from '@/i18n';

const acts = {
  resumeGsc: vi.fn(), connectGsc: vi.fn(), refreshGscData: vi.fn(),
  inspectGscUrl: vi.fn(), setGscFilters: vi.fn(),
};
const ev = { preventDefault: vi.fn() } as unknown as FormEvent;

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
