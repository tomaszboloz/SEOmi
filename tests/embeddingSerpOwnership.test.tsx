import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEmbeddingSession, useEmbeddingClustering } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';
import { clusterKeywordsByEmbedding, type EmbeddingClusteringResult } from '@/services/embeddingClustering';
import type { SerpSnapshot } from '@/services/serpImport/contracts';
import * as storageContracts from '@/services/storageContracts';

vi.mock('@/services/embeddingClustering', async (original) => ({
  ...await original<typeof import('@/services/embeddingClustering')>(), clusterKeywordsByEmbedding: vi.fn(),
}));

const result: EmbeddingClusteringResult = { method: 'embeddings', provider: 'local', model: 'fixture', threshold: 0.5, clusters: [], unclusteredKeywords: ['a', 'b'], analyzedAt: '2026-10-06' };
const snapshot = (keyword: string, provider: string): SerpSnapshot => ({
  keyword, rows: [{ rank: 1, url: `https://${provider}.test/${keyword}` }], urls: [`https://${provider}.test/${keyword}`], source: {
    kind: 'json-import', provider, sourceUrl: null, countryCode: 'PL', locationCode: 2616, languageCode: 'pl', capturedAt: '2026-10-06T10:00:00Z', retrievedAt: '2026-10-06T10:01:00Z', availability: 'complete', reason: null,
  },
});
const pending = () => {
  let resolve!: (value: EmbeddingClusteringResult) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<EmbeddingClusteringResult>((yes, no) => { resolve = yes; reject = no; });
  vi.mocked(clusterKeywordsByEmbedding).mockReturnValueOnce(promise);
  return { resolve, reject };
};

beforeEach(() => { localStorage.clear(); vi.mocked(clusterKeywordsByEmbedding).mockReset(); });
afterEach(cleanup);

describe('embedding SERP ownership', () => {
  it('forwards the third snapshot argument to the clustering service', async () => {
    vi.mocked(clusterKeywordsByEmbedding).mockResolvedValueOnce(result);
    const snapshots = [snapshot('a', 'paid-provider'), snapshot('b', 'paid-provider')];
    const hook = renderHook(() => useEmbeddingClustering('p1', ['a', 'b'], snapshots));
    await act(async () => { await hook.result.current.run(); });
    expect(clusterKeywordsByEmbedding).toHaveBeenCalledWith(['a', 'b'], expect.objectContaining({ serpSnapshots: snapshots }));
    expect(loadEmbeddingSession('p1').result).toEqual(result);
  });

  it('ignores a completion after SERP snapshots are swapped or cleared', async () => {
    const first = pending();
    const hook = renderHook(({ snapshots }) => useEmbeddingClustering('p1', ['a', 'b'], snapshots), { initialProps: { snapshots: [snapshot('a', 'source-a')] } });
    let running!: Promise<void>;
    act(() => { running = hook.result.current.run(); });
    hook.rerender({ snapshots: [snapshot('a', 'source-b')] });
    hook.rerender({ snapshots: [] });
    expect(hook.result.current.isRunning).toBe(false);
    await act(async () => { first.resolve(result); await running; });
    expect(hook.result.current.result).toBeNull();
    expect(loadEmbeddingSession('p1').result).toBeNull();
  });

  it('does not persist a pending old project result after switching projects', async () => {
    const old = pending();
    const hook = renderHook(({ project }) => useEmbeddingClustering(project, ['a', 'b'], [snapshot('a', 'paid')] ), { initialProps: { project: 'p1' } });
    let running!: Promise<void>;
    act(() => { running = hook.result.current.run(); });
    hook.rerender({ project: 'p2' });
    await act(async () => { old.resolve(result); await running; });
    expect(loadEmbeddingSession('p1').result).toBeNull();
    expect(loadEmbeddingSession('p2').result).toBeNull();
    expect(hook.result.current.result).toBeNull();
  });

  it('retains a stored SERP result when a new source enters the owner key', () => {
    localStorage.setItem('seomi_project_p1_embedding_clustering_v1', JSON.stringify({ provider: 'local', threshold: 0.5, ollamaModel: 'fixture', labelModel: '', result }));
    const original = [snapshot('a', 'stored-paid')];
    const hook = renderHook(({ snapshots }) => useEmbeddingClustering('p1', ['a', 'b'], snapshots), { initialProps: { snapshots: original } });
    hook.rerender({ snapshots: [snapshot('a', 'new-free-source')] });
    expect(hook.result.current.result).toEqual(result);
    expect(loadEmbeddingSession('p1').result).toEqual(result);
  });

  it('returns safe defaults when persisted session parsing fails or storage throws', () => {
    const read = vi.spyOn(storageContracts, 'readJsonRecord');
    read.mockReturnValueOnce(null as never);
    expect(loadEmbeddingSession('p1').result).toBeNull();
    read.mockImplementationOnce(() => { throw new Error('storage read failed'); });
    expect(loadEmbeddingSession('p1').result).toBeNull();
    read.mockRestore();
  });

  it('keeps a successful result in memory for a projectless owner without storage', async () => {
    vi.mocked(clusterKeywordsByEmbedding).mockResolvedValueOnce(result);
    const hook = renderHook(() => useEmbeddingClustering(null, ['a', 'b']));
    await act(async () => { await hook.result.current.run(); });
    expect(hook.result.current.result).toEqual(result);
    expect(localStorage.length).toBe(0);
  });

  it('reports an Error object from the current run', async () => {
    vi.mocked(clusterKeywordsByEmbedding).mockRejectedValueOnce(new Error('current error'));
    const hook = renderHook(() => useEmbeddingClustering(null, ['a', 'b']));
    await act(async () => { await hook.result.current.run(); });
    expect(hook.result.current.error).toBe('current error');
  });

  it('guards persistence even if an operation scope incorrectly reports a stale completion as current', async () => {
    vi.resetModules();
    vi.doMock('@/hooks/useAsyncOperationScope', () => ({ useAsyncOperationScope: () => () => () => true }));
    try {
      const isolated = await import('@/components/Keywords/embeddingClustering/useEmbeddingClustering');
      const service = await import('@/services/embeddingClustering');
      let resolve!: (value: EmbeddingClusteringResult) => void;
      const deferred = new Promise<EmbeddingClusteringResult>((yes) => { resolve = yes; });
      vi.mocked(service.clusterKeywordsByEmbedding).mockReturnValueOnce(deferred);
      const hook = renderHook(({ snapshots }) => isolated.useEmbeddingClustering('p1', ['a', 'b'], snapshots), { initialProps: { snapshots: [snapshot('a', 'old')] } });
      let running!: Promise<void>;
      act(() => { running = hook.result.current.run(); });
      hook.rerender({ snapshots: [snapshot('a', 'new')] });
      await act(async () => { resolve(result); await running; });
      expect(hook.result.current.result).toBeNull();
      expect(loadEmbeddingSession('p1').result).toBeNull();
    } finally {
      vi.doUnmock('@/hooks/useAsyncOperationScope');
      vi.resetModules();
    }
  });
});
