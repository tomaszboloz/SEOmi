import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingClusterResults } from '@/components/Keywords/embeddingClustering/EmbeddingClusterResults';
import { loadEmbeddingSession, useEmbeddingClustering } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';
import type { EmbeddingClusteringResult } from '@/services/embeddingClustering';
import i18n from '@/i18n';

const { clusterMock } = vi.hoisted(() => ({ clusterMock: vi.fn() }));
vi.mock('@/services/embeddingClustering', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/services/embeddingClustering')>(),
  clusterKeywordsByEmbedding: clusterMock,
}));

const result: EmbeddingClusteringResult = {
  method: 'embeddings', provider: 'local', model: 'fixture', threshold: 0.4,
  clusters: [{ id: 'cluster-1', keywords: ['alpha', 'beta'], label: null, cohesion: 0.4 }],
  unclusteredKeywords: ['lonely'], analyzedAt: '2026-10-05T00:00:00Z',
};

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); clusterMock.mockReset(); });
afterEach(cleanup);

describe('embedding results and session edges', () => {
  it('renders fallback labels, low cohesion and unclustered phrases from the result contract', () => {
    render(<EmbeddingClusterResults result={result} />);
    expect(screen.getByRole('heading', { name: /^Cluster 1/ })).toBeTruthy();
    expect(screen.getByText('cohesion 40%')).toBeTruthy();
    expect(screen.getByText('alpha')).toBeTruthy();
    expect(screen.getByText('Unclustered (1)')).toBeTruthy();
    expect(screen.getByText('lonely')).toBeTruthy();
    expect(screen.getByRole('article').className).toContain('border-slate-800');
  });

  it('loads persisted settings and publishes a current successful run to project storage', async () => {
    localStorage.setItem('seomi_project_p1_embedding_clustering_v1', JSON.stringify({ ...result, provider: 'hybrid', threshold: 0.61, ollamaModel: 'qwen', labelModel: 'labeler', result }));
    expect(loadEmbeddingSession('p1')).toMatchObject({ settings: { provider: 'hybrid', threshold: 0.61, ollamaModel: 'qwen', labelModel: 'labeler' }, result });
    clusterMock.mockResolvedValueOnce(result);
    const hook = renderHook(() => useEmbeddingClustering('p1', ['alpha', 'beta']));
    await act(async () => { await hook.result.current.run(); });
    expect(clusterMock).toHaveBeenCalledWith(['alpha', 'beta'], expect.objectContaining({ provider: 'hybrid', threshold: 0.61, ollamaModel: 'qwen', labelModel: 'labeler' }));
    expect(hook.result.current.result).toEqual(result);
    expect(loadEmbeddingSession('p1').result).toEqual(result);
    act(() => { hook.result.current.updateSettings({ threshold: null }); });
    expect(loadEmbeddingSession('p1').settings.threshold).toBeNull();
  });
});
