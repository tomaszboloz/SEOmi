import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useEmbeddingClustering, loadEmbeddingSession } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';
import { clusterKeywordsByEmbedding, type EmbeddingClusteringResult } from '@/services/embeddingClustering';

vi.mock('@/services/embeddingClustering', async (original) => ({
  ...await original<typeof import('@/services/embeddingClustering')>(),
  clusterKeywordsByEmbedding: vi.fn(),
}));
const result: EmbeddingClusteringResult = {
  method: 'embeddings', provider: 'local', model: 'fixture', threshold: 0.5,
  clusters: [], unclusteredKeywords: ['a', 'b'], analyzedAt: '2026-10-05',
};
const pending = () => {
  let resolve!: (value: EmbeddingClusteringResult) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<EmbeddingClusteringResult>((yes, no) => { resolve = yes; reject = no; });
  vi.mocked(clusterKeywordsByEmbedding).mockReturnValueOnce(promise);
  return { resolve, reject };
};
beforeEach(() => { localStorage.clear(); vi.mocked(clusterKeywordsByEmbedding).mockReset(); });
afterEach(cleanup);

it('does not publish or persist after unmount', async () => {
  const task = pending();
  const hook = renderHook(() => useEmbeddingClustering('p1', ['a', 'b']));
  let running!: Promise<void>;
  act(() => { running = hook.result.current.run(); });
  hook.unmount();
  await act(async () => { task.resolve(result); await running; });
  expect(loadEmbeddingSession('p1').result).toBeNull();
});

it('keeps changed settings when an older completion arrives', async () => {
  const task = pending();
  const hook = renderHook(() => useEmbeddingClustering('p1', ['a', 'b']));
  let running!: Promise<void>;
  act(() => { running = hook.result.current.run(); });
  act(() => { hook.result.current.updateSettings({ threshold: 0.8 }); });
  expect(hook.result.current.isRunning).toBe(false);
  await act(async () => { task.resolve(result); await running; });
  expect(hook.result.current.settings.threshold).toBe(0.8);
  expect(loadEmbeddingSession('p1').settings.threshold).toBe(0.8);
  expect(hook.result.current.result).toBeNull();
});

it('invalidates work when the keyword contents change', async () => {
  const task = pending();
  const hook = renderHook(({ words }) => useEmbeddingClustering('p1', words), { initialProps: { words: ['a', 'b'] } });
  let running!: Promise<void>;
  act(() => { running = hook.result.current.run(); });
  hook.rerender({ words: ['c', 'd'] });
  expect(hook.result.current.isRunning).toBe(false);
  await act(async () => { task.reject(new Error('old failure')); await running; });
  expect(hook.result.current.error).toBeNull();
  expect(hook.result.current.result).toBeNull();
});

it('rejects retained callbacks from a previous project', async () => {
  const hook = renderHook(({ project }) => useEmbeddingClustering(project, ['a', 'b']), { initialProps: { project: 'p1' } });
  const old = hook.result.current;
  hook.rerender({ project: 'p2' });
  await act(async () => { old.updateSettings({ threshold: 0.8 }); await old.run(); });
  expect(clusterKeywordsByEmbedding).not.toHaveBeenCalled();
  expect(loadEmbeddingSession('p1').settings.threshold).toBeNull();
  expect(hook.result.current.settings.threshold).toBeNull();
  expect(hook.result.current.isRunning).toBe(false);
});

it('keeps the latest overlapping run and ignores an older rejection', async () => {
  const first = pending();
  const second = pending();
  const hook = renderHook(() => useEmbeddingClustering('p1', ['a', 'b']));
  let older!: Promise<void>;
  let newer!: Promise<void>;
  act(() => { older = hook.result.current.run(); newer = hook.result.current.run(); });
  await act(async () => { first.reject('old failure'); await older; });
  expect(hook.result.current.isRunning).toBe(true);
  expect(hook.result.current.error).toBeNull();
  await act(async () => { second.resolve(result); await newer; });
  expect(hook.result.current.result).toEqual(result);
  expect(hook.result.current.isRunning).toBe(false);
});

it('rejects retained callbacks after leaving and returning to the same project', async () => {
  const hook = renderHook(({ project }) => useEmbeddingClustering(project, ['a', 'b']), { initialProps: { project: 'p1' } });
  const old = hook.result.current;
  hook.rerender({ project: 'p2' });
  hook.rerender({ project: 'p1' });
  await act(async () => { old.updateSettings({ threshold: 0.8 }); await old.run(); });
  expect(clusterKeywordsByEmbedding).not.toHaveBeenCalled();
  expect(loadEmbeddingSession('p1').settings.threshold).toBeNull();
});

it('accepts equivalent keyword arrays and reports a current non-Error rejection', async () => {
  const task = pending();
  const hook = renderHook(({ words }) => useEmbeddingClustering(null, words), { initialProps: { words: ['a', 'b'] } });
  let running!: Promise<void>;
  act(() => { running = hook.result.current.run(); });
  hook.rerender({ words: ['a', 'b'] });
  expect(hook.result.current.isRunning).toBe(true);
  await act(async () => { task.reject('current failure'); await running; });
  expect(hook.result.current.error).toBe('current failure');
  expect(hook.result.current.isRunning).toBe(false);
  expect(localStorage.length).toBe(0);
});
