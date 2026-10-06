import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrendingNowSession } from '@/components/KeywordResearch/useTrendingNowSession';
import { useProjectStore } from '@/stores/projectStore';
import { MAX_TRENDING_PAYLOAD_BYTES, type TrendingSnapshot } from '@/services/trendingNow';
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
const file = (name: string, type: string, text = '{}') => Object.assign(new File([text], name, { type }), { text: vi.fn().mockResolvedValue(text) });

describe('useTrendingNowSession', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useProjectStore.setState({ activeProjectId: null });
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.read.mockReturnValue(null); mocks.save.mockReturnValue(true); mocks.clear.mockReturnValue(true);
  });

  it('loads the active project and resets to the default scope after switching away', async () => {
    mocks.read.mockReturnValue(snapshot);
    useProjectStore.setState({ activeProjectId: 'p1' });
    const { result } = renderHook(() => useTrendingNowSession());
    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
    expect(result.current.geo).toBe('US');
    act(() => useProjectStore.setState({ activeProjectId: null }));
    await waitFor(() => expect(result.current.snapshot).toBeNull());
    expect(result.current.geo).toBe('PL');
  });

  it('reports missing project and unsupported bounded imports without network calls', async () => {
    const { result } = renderHook(() => useTrendingNowSession());
    await act(async () => { await result.current.refresh(); });
    expect(result.current.error).toContain('Select a project');
    await act(async () => { await result.current.importFile(file('data.txt', 'text/plain')); });
    expect(result.current.error).toContain('Select a project');
    act(() => result.current.clear());
    expect(result.current.error).toContain('Select a project');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('keeps a truthful in-memory result when persistence fails and clears it only after a durable remove', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    mocks.fetch.mockResolvedValue(snapshot); mocks.save.mockReturnValue(false); mocks.clear.mockReturnValue(false);
    const { result } = renderHook(() => useTrendingNowSession());
    await act(async () => { await result.current.refresh(); });
    expect(result.current.snapshot).toEqual(snapshot);
    expect(result.current.error).toContain('storage is unavailable');
    act(() => result.current.clear());
    expect(result.current.snapshot).toEqual(snapshot);
    mocks.clear.mockReturnValue(true);
    act(() => result.current.clear());
    expect(result.current.snapshot).toBeNull();
  });

  it('imports JSON by MIME, exposes raw import errors and rejects an oversized file', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    mocks.importFile.mockReturnValue({ ...snapshot, source: { kind: 'json-import', url: null } });
    const { result } = renderHook(() => useTrendingNowSession());
    await act(async () => { await result.current.importFile(file('data.txt', 'text/plain')); });
    expect(result.current.error).toContain('Choose a .csv or .json file');
    await act(async () => { await result.current.importFile(file('data', 'application/json')); });
    expect(mocks.importFile).toHaveBeenCalledWith('p1', '{}', 'json', 'PL');
    mocks.importFile.mockImplementation(() => { throw new Error('invalid JSON'); });
    await act(async () => { await result.current.importFile(file('data.csv', 'text/csv', 'bad')); });
    expect(result.current.error).toBe('invalid JSON');
    mocks.importFile.mockImplementation(() => { throw 'bad import'; });
    await act(async () => { await result.current.importFile(file('data.csv', 'text/csv', 'bad')); });
    expect(result.current.error).toContain('The import could not be read');
    const oversized = { name: 'data.csv', type: 'text/csv', size: MAX_TRENDING_PAYLOAD_BYTES + 1 } as File;
    await act(async () => { await result.current.importFile(oversized); });
    expect(result.current.error).toContain('1 MiB');
  });

  it('handles FileReader fallbacks and read failures without inventing imported data', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    mocks.importFile.mockReturnValue(snapshot);
    const nativeReader = globalThis.FileReader;
    class EmptyReader {
      result = '';
      error: Error | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText() { this.onload?.(); }
    }
    vi.stubGlobal('FileReader', EmptyReader);
    const { result } = renderHook(() => useTrendingNowSession());
    const fallback = { name: 'data.csv', type: 'text/csv', size: 1 } as File;
    await act(async () => { await result.current.importFile(fallback); });
    expect(mocks.importFile).toHaveBeenCalledWith('p1', '', 'csv', 'PL');
    class ErrorReader extends EmptyReader {
      error = new Error('read failed');
      readAsText() { this.onerror?.(); }
    }
    vi.stubGlobal('FileReader', ErrorReader);
    await act(async () => { await result.current.importFile(fallback); });
    expect(result.current.error).toBe('read failed');
    class NullErrorReader extends EmptyReader {
      readAsText() { this.onerror?.(); }
    }
    vi.stubGlobal('FileReader', NullErrorReader);
    await act(async () => { await result.current.importFile(fallback); });
    expect(result.current.error).toContain('Unable to read file');
    vi.stubGlobal('FileReader', nativeReader);
  });

  it('ignores a response that completes after the project scope changes', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    let resolve: (value: TrendingSnapshot) => void = () => undefined;
    mocks.fetch.mockReturnValue(new Promise<TrendingSnapshot>((done) => { resolve = done; }));
    const { result } = renderHook(() => useTrendingNowSession());
    act(() => { void result.current.refresh(); });
    act(() => useProjectStore.setState({ activeProjectId: 'p2' }));
    resolve(snapshot);
    await waitFor(() => expect(result.current.activeProjectId).toBe('p2'));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(result.current.snapshot).toBeNull();
  });

});
