import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useEmbeddingClustering } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';
import { clusterKeywordsByEmbedding, type EmbeddingClusteringResult } from '@/services/embeddingClustering';
import { loadSerpHistory } from '@/services/semanticDecay/snapshotStore';
import { hybridRun, importedSnapshot } from './fixtures/decayHistory';

vi.mock('@/services/embeddingClustering', async (original) => ({
  ...await original<typeof import('@/services/embeddingClustering')>(), clusterKeywordsByEmbedding: vi.fn(),
}));
beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); vi.mocked(clusterKeywordsByEmbedding).mockReset(); });
afterEach(cleanup);

describe('hybrid run history integration', () => {
  it('records a successful current run and preserves its existing feature result', async () => {
    const run = hybridRun();
    vi.mocked(clusterKeywordsByEmbedding).mockResolvedValueOnce(run);
    const hook = renderHook(() => useEmbeddingClustering('p1', ['query', 'other'], [importedSnapshot()]));
    await act(async () => { await hook.result.current.run(); });
    expect(hook.result.current.result).toBe(run);
    expect(hook.result.current.error).toBeNull();
    expect(loadSerpHistory('p1').snapshots).toHaveLength(1);
  });

  it('never records a failed run', async () => {
    vi.mocked(clusterKeywordsByEmbedding).mockRejectedValueOnce(new Error('offline fixture failure'));
    const hook = renderHook(() => useEmbeddingClustering('p1', ['query', 'other'], [importedSnapshot()]));
    await act(async () => { await hook.result.current.run(); });
    expect(hook.result.current.error).toBe('offline fixture failure');
    expect(loadSerpHistory('p1').snapshots).toEqual([]);
  });

  it.each(['switch', 'unmount', 'settings', 'observations'] as const)('does not record stale completions after %s', async (change) => {
    let resolve!: (value: EmbeddingClusteringResult) => void;
    vi.mocked(clusterKeywordsByEmbedding).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const hook = renderHook(({ project, snapshots }) => useEmbeddingClustering(project, ['query', 'other'], snapshots), {
      initialProps: { project: 'p1', snapshots: [importedSnapshot()] },
    });
    let running!: Promise<void>;
    act(() => { running = hook.result.current.run(); });
    if (change === 'switch') hook.rerender({ project: 'p2', snapshots: [importedSnapshot()] });
    if (change === 'unmount') hook.unmount();
    if (change === 'settings') act(() => { hook.result.current.updateSettings({ threshold: 0.8 }); });
    if (change === 'observations') hook.rerender({ project: 'p1', snapshots: [importedSnapshot({ locationCode: 2840 })] });
    await act(async () => { resolve(hybridRun()); await running; });
    expect(loadSerpHistory('p1').snapshots).toEqual([]);
    expect(loadSerpHistory('p2').snapshots).toEqual([]);
  });
});
