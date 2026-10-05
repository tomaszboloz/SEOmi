import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { readGscSnapshots, saveGscSnapshot } from '@/services/gscPerformanceTracker';
import type { GscPerformanceData } from '@/types';
import i18n from '@/i18n';

const SITE = 'sc-domain:a.test';
const data = (clicks: number, site = SITE): GscPerformanceData => ({
  site_url: site, start_date: '2026-09-01', end_date: '2026-09-28', total_clicks: clicks,
  total_impressions: 1000, avg_ctr: 0.01, avg_position: 8,
  queries: [{ query: 'seo', clicks, impressions: 500, ctr: 0.02, position: 9 }],
  pages: [{ page: 'https://a.test/', clicks, impressions: 500, ctr: 0.02, position: 9 }],
  daily: [{ date: '2026-09-01', clicks, impressions: 1000, ctr: 0.01, position: 8 }],
  queries_may_be_truncated: false, pages_may_be_truncated: false, daily_may_be_truncated: false,
  max_rows_per_dimension: 25000,
});

describe('useSearchConsoleSession snapshots', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    useProjectStore.setState({ activeProjectId: 'p1' });
    useToolsStore.setState({
      gscClientId: '', isGscConnected: true, gscProperty: SITE, gscData: null, gscFilters: {},
    } as never);
  });

  it('loads stored snapshots for the property and picks the first as baseline', () => {
    saveGscSnapshot('p1', data(5));
    saveGscSnapshot('p1', data(7, 'sc-domain:other.test'));
    const { result } = renderHook(() => useSearchConsoleSession());
    expect(result.current.snapshots.map((s) => s.site_url)).toEqual([SITE]);
    expect(result.current.baselineId).toBe(result.current.snapshots[0].id);
    expect(result.current.baselineSnapshot).toEqual(result.current.snapshots[0]);
  });

  it('keeps every snapshot when no property is selected and clears without a project', () => {
    saveGscSnapshot('p1', data(5));
    useToolsStore.setState({ gscProperty: '' } as never);
    const { result } = renderHook(() => useSearchConsoleSession());
    expect(result.current.snapshots).toHaveLength(1);
    act(() => useProjectStore.setState({ activeProjectId: null }));
    expect(result.current.snapshots).toEqual([]);
    expect(result.current.baselineId).toBe('');
  });

  it('computes current snapshot, comparison and striking distance from live data', () => {
    saveGscSnapshot('p1', data(5));
    useToolsStore.setState({ gscData: data(25) } as never);
    const { result } = renderHook(() => useSearchConsoleSession());
    expect(result.current.currentSnapshot?.site_url).toBe(SITE);
    expect(result.current.comparison).not.toBeNull();
    expect(Array.isArray(result.current.strikingDistance)).toBe(true);
  });

  it('has no current snapshot or comparison for data from another property', () => {
    useToolsStore.setState({ gscData: data(25, 'sc-domain:other.test') } as never);
    const { result } = renderHook(() => useSearchConsoleSession());
    expect(result.current.currentSnapshot).toBeNull();
    expect(result.current.comparison).toBeNull();
  });

  it('saves a snapshot, announces it and picks an older baseline on the next save', () => {
    useToolsStore.setState({ gscData: data(10) } as never);
    const { result } = renderHook(() => useSearchConsoleSession());
    act(() => result.current.handleSaveSnapshot());
    expect(readGscSnapshots('p1')).toHaveLength(1);
    expect(result.current.trackerMessage).toBe(
      i18n.t('searchConsole.snapshotSaved', { start: '2026-09-01', end: '2026-09-28' }),
    );
    expect(result.current.baselineId).toBe('');
    act(() => useToolsStore.setState({ gscData: { ...data(12), end_date: '2026-09-29' } } as never));
    act(() => result.current.handleSaveSnapshot());
    expect(result.current.snapshots).toHaveLength(2);
    expect(result.current.baselineId).not.toBe('');
  });

  it('skips saving without data, project or matching property', () => {
    const { result } = renderHook(() => useSearchConsoleSession());
    act(() => result.current.handleSaveSnapshot());
    useToolsStore.setState({ gscData: data(1, 'sc-domain:other.test') } as never);
    act(() => result.current.handleSaveSnapshot());
    expect(readGscSnapshots('p1')).toEqual([]);
    expect(result.current.trackerMessage).toBe('');
  });

  it.each([
    ['an Error message', new Error('disk full'), 'disk full'],
    ['the translated fallback', 'str', i18n.t('searchConsole.snapshotSaveError', { lng: 'en' })],
  ])('reports save failure with %s', (_n, thrown, expected) => {
    useToolsStore.setState({ gscData: data(10) } as never);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw thrown; });
    const { result } = renderHook(() => useSearchConsoleSession());
    act(() => result.current.handleSaveSnapshot());
    spy.mockRestore();
    expect(result.current.trackerMessage).toBe(expected);
  });
});
