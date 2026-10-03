import { describe, expect, it, vi } from 'vitest';
import { clusterKeywordsByEmbedding, defaultEmbeddingThreshold, embeddingClusteringResultSchema, LOCAL_OLLAMA_URL, MAX_EMBEDDING_KEYWORDS } from '@/services/embeddingClustering';

const keywords = ['robots.txt disallow rules', 'jak zablokować stronę w robots.txt', 'robots txt dla googlebota', 'hreflang x-default', 'hreflang dla wersji językowych', 'jak zrobić przekierowanie 301 htaccess'];

describe('embedding keyword clustering', () => {
  it('groups related phrases locally without network access and reports cohesion', async () => {
    const fetchImpl = vi.fn();
    const result = await clusterKeywordsByEmbedding(keywords, { provider: 'local', fetchImpl, analyzedAt: '2026-10-03T00:00:00.000Z' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.clusters.map(cluster => cluster.keywords)).toEqual([keywords.slice(0, 3), keywords.slice(3, 5)]);
    expect(result.unclusteredKeywords).toEqual([keywords[5]]);
    expect(result.threshold).toBe(defaultEmbeddingThreshold('local'));
    expect(result.clusters.every(cluster => cluster.cohesion > 0 && cluster.cohesion <= 1 && cluster.label === null)).toBe(true);
    expect(embeddingClusteringResultSchema.parse(result)).toEqual(result);
  });

  it('respects an explicit threshold', async () => {
    const strict = await clusterKeywordsByEmbedding(keywords, { provider: 'local', threshold: 0.99 });
    expect(strict.clusters).toEqual([]);
    expect(strict.unclusteredKeywords).toHaveLength(keywords.length);
  });

  it('uses only the loopback Ollama endpoint for embeddings and group names', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { input?: string[] };
      if (url.endsWith('/api/embed')) return new Response(JSON.stringify({ embeddings: body.input!.map(text => text.includes('hreflang') ? [0, 1] : [1, 0]) }));
      return new Response(JSON.stringify({ response: 'Hreflang setup' }));
    });
    const result = await clusterKeywordsByEmbedding(keywords.slice(3, 5).concat(keywords.slice(0, 1)), { provider: 'ollama', ollamaModel: ' bge-m3 ', labelModel: 'llama3.2', fetchImpl });
    expect(fetchImpl.mock.calls.every(call => String(call[0]).startsWith(LOCAL_OLLAMA_URL))).toBe(true);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1].body)).model).toBe('bge-m3');
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].label).toBe('Hreflang setup');
    expect(result.model).toBe('bge-m3');
  });

  it('rejects too few or too many keywords', async () => {
    await expect(clusterKeywordsByEmbedding(['one'], { provider: 'local' })).rejects.toThrow(/two/);
    await expect(clusterKeywordsByEmbedding(Array.from({ length: MAX_EMBEDDING_KEYWORDS + 1 }, (_, i) => `k${i}`), { provider: 'local' })).rejects.toThrow(/At most/);
  });

  it('surfaces an unreachable Ollama with setup instructions', async () => {
    await expect(clusterKeywordsByEmbedding(keywords, { provider: 'hybrid', fetchImpl: vi.fn().mockRejectedValue(new TypeError('fetch failed')) })).rejects.toThrow(/ollama serve/);
  });
});
