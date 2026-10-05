import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeywordClusteringSession } from '@/components/Keywords/keywordClustering/useKeywordClusteringSession';
import { sessionKey } from '@/components/Keywords/keywordClustering/keywordClusteringTypes';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import i18n from '@/i18n';

const { serpMock } = vi.hoisted(() => ({ serpMock: vi.fn() }));
vi.mock('@/services/dataforseo', async (orig) => ({
  ...(await orig<typeof import('@/services/dataforseo')>()),
  DataForSEOClient: vi.fn().mockImplementation(function Client() {
    return { getSerpCompetitors: serpMock };
  }),
}));

const t = i18n.t.bind(i18n);
const setup = () => renderHook(() => useKeywordClusteringSession(t));
const rows = (n: string) => [1, 2, 3].map((i) => ({ url: `https://${n}.example/${i}` }));

describe('useKeywordClusteringSession runClustering', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    serpMock.mockReset().mockImplementation(async () => rows('shared'));
    useProjectStore.setState({ activeProjectId: 'p1' });
    useSettingsStore.setState({ dataForSeoCredentials: { login: 'l', password: 'p' } });
  });

  it('fetches every keyword, clusters by overlap and persists the result', async () => {
    const { result } = setup();
    act(() => result.current.updateSession({ input: 'a\nb' }));
    await act(async () => result.current.runClustering());
    expect(serpMock).toHaveBeenCalledTimes(2);
    expect(result.current.progress).toBe(2);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.session.result?.clusters[0].keywords).toEqual(['a', 'b']);
    expect(JSON.parse(localStorage.getItem(sessionKey('p1'))!).result.snapshots).toHaveLength(2);
  });

  it('reuses cached snapshots (normalizing bare URLs) and only fetches missing keywords', async () => {
    const snap = (keyword: string) => ({ keyword, urls: ['x.example/1', 'x.example/2', 'x.example/3'] });
    localStorage.setItem(sessionKey('p1'), JSON.stringify({
      input: 'a\nb',
      minSharedUrls: 3,
      result: { clusters: [], unclusteredKeywords: [], snapshots: [snap('a'), { keyword: 'gone', urls: ['https://k.example/1'] }], minSharedUrls: 3, analyzedAt: new Date().toISOString() },
    }));
    const { result } = setup();
    await act(async () => result.current.runClustering());
    expect(serpMock).toHaveBeenCalledTimes(1);
    expect(serpMock.mock.calls[0][0]).toBe('b');
    const snaps = result.current.session.result?.snapshots ?? [];
    expect(snaps.map((s) => s.keyword)).toEqual(['a', 'b']);
    expect(snaps[0].urls[0]).toBe('x.example/1');
  });

  it('keeps cached snapshot URLs that already carry a scheme', async () => {
    const urls = ['https://x.example/1', 'http://x.example/2', 'https://x.example/3'];
    localStorage.setItem(sessionKey('p1'), JSON.stringify({
      input: 'a\nb',
      result: { clusters: [], unclusteredKeywords: [], snapshots: [{ keyword: 'a', urls }], minSharedUrls: 3, analyzedAt: new Date().toISOString() },
    }));
    const { result } = setup();
    serpMock.mockResolvedValue(urls.map((url) => ({ url })));
    await act(async () => result.current.runClustering());
    expect(result.current.session.result?.clusters[0].keywords).toEqual(['a', 'b']);
    expect(result.current.session.result?.clusters[0].pairOverlaps[0].sharedUrls).toHaveLength(3);
  });

  it('shows an interruption message with the thrown Error message', async () => {
    serpMock.mockResolvedValueOnce(rows('s')).mockRejectedValueOnce(new Error('quota'));
    const { result } = setup();
    act(() => result.current.updateSession({ input: 'a\nb' }));
    await act(async () => result.current.runClustering());
    expect(result.current.error).toBe(
      t('keywordClusteringUi.interrupted', { completed: 1, total: 2, message: 'quota' }),
    );
    expect(result.current.isRunning).toBe(false);
  });

  it('falls back to the translated fetch error for non-Error rejections', async () => {
    serpMock.mockRejectedValueOnce('nope');
    const { result } = setup();
    act(() => result.current.updateSession({ input: 'a\nb' }));
    await act(async () => result.current.runClustering());
    expect(result.current.error).toContain(t('keywordClusteringUi.fetchError'));
  });

  it('abandons the run silently when the project switches mid-flight', async () => {
    serpMock.mockImplementationOnce(async () => {
      useProjectStore.setState({ activeProjectId: 'p2' });
      return rows('s');
    });
    const { result } = setup();
    act(() => result.current.updateSession({ input: 'a\nb' }));
    await act(async () => result.current.runClustering());
    expect(serpMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(sessionKey('p2'))).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('ignores a rejection that arrives after the project switched', async () => {
    serpMock.mockImplementationOnce(async () => {
      useProjectStore.setState({ activeProjectId: 'p2' });
      throw new Error('late');
    });
    const { result } = setup();
    act(() => result.current.updateSession({ input: 'a\nb' }));
    await act(async () => result.current.runClustering());
    expect(result.current.error).toBeNull();
  });

  it('stops before the next keyword when the project changed between iterations', async () => {
    const { result } = setup();
    act(() => result.current.updateSession({ input: 'a\nb' }));
    const real = useProjectStore.getState();
    const spy = vi.spyOn(useProjectStore, 'getState');
    spy.mockReturnValueOnce(real).mockReturnValueOnce(real)
      .mockReturnValue({ ...real, activeProjectId: 'other' });
    await act(async () => result.current.runClustering());
    spy.mockRestore();
    expect(serpMock).toHaveBeenCalledTimes(1);
    expect(result.current.session.result?.snapshots).toHaveLength(1);
  });
});
