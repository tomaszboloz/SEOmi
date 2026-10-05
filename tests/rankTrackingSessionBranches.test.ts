import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';
import { useRankTrackingSession } from '@/components/Keywords/rankTracking/useRankTrackingSession';
import { useToolsStore } from '@/stores/toolsStore';

const { marketMock } = vi.hoisted(() => ({ marketMock: vi.fn() }));
vi.mock('@/services/dataforseo', async (orig) => ({ ...(await orig<object>()), resolveDataForSeoMarket: marketMock }));

const rank = (id: string, current: number | null) => ({ id, current_rank: current });
const draft = (over: object = {}) => ({ keyword: 'kw', domain: 'a.test', targetUrl: '/p', location: 'Poland', language: 'pl', ...over });
const event = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent & { preventDefault: ReturnType<typeof vi.fn> };
const seed = (over: object = {}) => {
  const addTrackedRank = vi.fn(); const setRankTrackingDraft = vi.fn();
  useToolsStore.setState({ trackedRanks: [], rankTrackingDraft: draft(), addTrackedRank, setRankTrackingDraft, ...over } as never);
  return { addTrackedRank, setRankTrackingDraft };
};

describe('useRankTrackingSession', () => {
  beforeEach(() => { marketMock.mockReset().mockReturnValue(undefined); });

  it('summarises only measured ranks', () => {
    seed({ trackedRanks: [rank('a', 1), rank('b', 3), rank('c', 7), rank('d', 20), rank('e', null)] });
    const { result } = renderHook(() => useRankTrackingSession());
    expect(result.current.totalTracked).toBe(5);
    expect(result.current.measuredRanks).toHaveLength(4);
    expect(result.current.inTop3).toBe(2);
    expect(result.current.inTop10).toBe(3);
    expect(result.current.avgPosition).toBe('7.8');
  });

  it('shows a dash when nothing has been measured', () => {
    seed({ trackedRanks: [rank('a', null)] });
    const { result } = renderHook(() => useRankTrackingSession());
    expect(result.current.avgPosition).toBe('—');
    expect(result.current.inTop10).toBe(0);
  });

  it('resolves the selected market from the draft location, or undefined', () => {
    seed();
    marketMock.mockReturnValueOnce({ code: 2616 });
    const first = renderHook(() => useRankTrackingSession());
    expect(marketMock).toHaveBeenCalledWith('Poland');
    expect(first.result.current.selectedMarket).toEqual({ code: 2616 });
    marketMock.mockReturnValue(null);
    expect(renderHook(() => useRankTrackingSession()).result.current.selectedMarket).toBeUndefined();
  });

  it('adds a tracked rank, resets the keyword and closes the modal', () => {
    const { addTrackedRank, setRankTrackingDraft } = seed();
    const { result } = renderHook(() => useRankTrackingSession());
    act(() => result.current.setShowAddModal(true));
    expect(result.current.showAddModal).toBe(true);
    const e = event();
    act(() => result.current.handleAddRank(e));
    expect(e.preventDefault).toHaveBeenCalled();
    expect(addTrackedRank).toHaveBeenCalledWith('kw', 'a.test', '/p', 'Poland', 'pl');
    expect(setRankTrackingDraft).toHaveBeenCalledWith({ keyword: '' });
    expect(result.current.showAddModal).toBe(false);
  });

  it.each([[{ keyword: '  ' }], [{ domain: '' }]])('rejects a draft with blank %j', (blank) => {
    const { addTrackedRank, setRankTrackingDraft } = seed({ rankTrackingDraft: draft(blank) });
    const { result } = renderHook(() => useRankTrackingSession());
    act(() => result.current.setShowAddModal(true));
    const e = event();
    act(() => result.current.handleAddRank(e));
    expect(e.preventDefault).toHaveBeenCalled();
    expect(addTrackedRank).not.toHaveBeenCalled();
    expect(setRankTrackingDraft).not.toHaveBeenCalled();
    expect(result.current.showAddModal).toBe(true);
  });
});
