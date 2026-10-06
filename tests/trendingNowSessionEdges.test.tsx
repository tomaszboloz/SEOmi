import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrendingNowSession } from '@/components/KeywordResearch/useTrendingNowSession';
import { useProjectStore } from '@/stores/projectStore';
import type { TrendingSnapshot } from '@/services/trendingNow';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), importFile: vi.fn(), read: vi.fn(), save: vi.fn(), clear: vi.fn() }));
vi.mock('@/services/trendingNow', async () => ({
  ...(await vi.importActual<typeof import('@/services/trendingNow')>('@/services/trendingNow')),
  fetchTrendingNow: mocks.fetch, importTrendingNow: mocks.importFile, readTrendingNow: mocks.read,
  saveTrendingNow: mocks.save, clearTrendingNow: mocks.clear,
}));

const snapshot: TrendingSnapshot = {
  projectId: 'p1', geo: 'US', capturedAt: '2026-10-06T08:00:00.000Z',
  source: { kind: 'google-trends-rss', url: 'https://trends.google.com/trending/rss?geo=US' },
  entries: [{ keyword: 'rower', trafficLabel: '20K+', startedAt: null }],
};
const pending = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

describe('useTrendingNowSession race and lifecycle edges', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useProjectStore.setState({ activeProjectId: null });
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.read.mockReturnValue(null); mocks.save.mockReturnValue(true); mocks.clear.mockReturnValue(true);
  });

  it('remains mounted and accepts a completed refresh under StrictMode', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    mocks.fetch.mockResolvedValue(snapshot);
    const { result } = renderHook(() => useTrendingNowSession(), { wrapper: StrictMode });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.snapshot).toEqual(snapshot);
    expect(result.current.error).toBeNull();
    expect(mocks.save).toHaveBeenCalledWith('p1', snapshot);
  });

  it('invalidates a pending refresh when the country changes', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    const request = pending<TrendingSnapshot>();
    mocks.fetch.mockReturnValue(request.promise);
    const { result } = renderHook(() => useTrendingNowSession());
    act(() => { void result.current.refresh(); });
    act(() => result.current.setGeo('DE'));
    act(() => request.resolve(snapshot));
    await waitFor(() => expect(result.current.geo).toBe('DE'));
    expect(result.current.snapshot).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('invalidates a pending refresh when clearing the saved snapshot', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    const request = pending<TrendingSnapshot>();
    mocks.fetch.mockReturnValue(request.promise);
    const { result } = renderHook(() => useTrendingNowSession());
    act(() => { void result.current.refresh(); });
    act(() => result.current.clear());
    act(() => request.resolve(snapshot));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.snapshot).toBeNull();
    expect(mocks.clear).toHaveBeenCalledWith('p1');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('ignores delayed import completion and failure after the project scope changes', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    const textRead = pending<string>();
    const file = { name: 'data.csv', type: 'text/csv', size: 2, text: () => textRead.promise } as File;
    mocks.importFile.mockReturnValue(snapshot);
    const { result } = renderHook(() => useTrendingNowSession());
    act(() => { void result.current.importFile(file); });
    act(() => useProjectStore.setState({ activeProjectId: 'p2' }));
    act(() => textRead.resolve('x'));
    await waitFor(() => expect(result.current.activeProjectId).toBe('p2'));
    expect(result.current.snapshot).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();

    const failedRead = pending<string>();
    const failingFile = { name: 'data.csv', type: 'text/csv', size: 2, text: () => failedRead.promise } as File;
    act(() => useProjectStore.setState({ activeProjectId: 'p1' }));
    act(() => { void result.current.importFile(failingFile); });
    act(() => useProjectStore.setState({ activeProjectId: 'p2' }));
    act(() => failedRead.reject(new Error('late read failure')));
    await waitFor(() => expect(result.current.activeProjectId).toBe('p2'));
    expect(result.current.error).toBeNull();
  });

  it('ignores delayed fetch failure after the project scope changes', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    const request = pending<TrendingSnapshot>();
    mocks.fetch.mockReturnValue(request.promise);
    const { result } = renderHook(() => useTrendingNowSession());
    act(() => { void result.current.refresh(); });
    act(() => useProjectStore.setState({ activeProjectId: 'p2' }));
    act(() => request.reject('late network'));
    await waitFor(() => expect(result.current.activeProjectId).toBe('p2'));
    expect(result.current.error).toBeNull();
  });

  it('uses a translated fallback for non-Error fetch failures', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    mocks.fetch.mockRejectedValue('network');
    const { result } = renderHook(() => useTrendingNowSession());
    await act(async () => { await result.current.refresh(); });
    expect(result.current.error).toContain('free Trends feed could not be loaded');
  });
});
