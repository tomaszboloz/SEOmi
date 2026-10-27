import { describe, expect, it, vi } from 'vitest';
import { clusterKeywordsByEmbedding, embeddingClusteringResultSchema } from '@/services/embeddingClustering';
import type { SerpSnapshot, SerpSource } from '@/services/serpImport/contracts';

const embeddingVectors: Record<string, number[]> = {
  alpha: [1, 0], beta: [0.4, 0.916515], gamma: [0.4, -0.916515], 'Alpha SEO': [1, 0], 'Beta SEO': [1, 0],
};
const source = (availability: SerpSource['availability'] = 'complete'): SerpSource => ({
  kind: 'json-import', provider: 'fixture', sourceUrl: null, countryCode: 'PL', locationCode: 2616, languageCode: 'pl',
  capturedAt: '2026-10-06T10:00:00Z', retrievedAt: '2026-10-06T10:01:00Z', availability, reason: availability === 'complete' ? null : 'fixture-partial',
});
const snapshot = (keyword: string, url: string, availability: SerpSource['availability'] = 'complete'): SerpSnapshot => ({
  keyword, rows: [{ rank: 1, url }], urls: [url], source: source(availability),
});
const fetchFixture = (withLabel = false) => vi.fn(async (input: string, init: RequestInit) => {
  const url = String(input); const body = JSON.parse(String(init.body)) as { input?: string[] };
  if (url.endsWith('/api/embed')) return new Response(JSON.stringify({ embeddings: body.input!.map((text) => embeddingVectors[text]) }));
  if (withLabel && url.endsWith('/api/generate')) return new Response(JSON.stringify({ response: 'Generated group label' }));
  throw new Error(`Unexpected fixture request: ${url}`);
});

describe('embedding and SERP integration', () => {
  it('changes groups when complete SERP overlap qualifies a pair', async () => {
    const keywords = ['alpha', 'beta', 'gamma'];
    const semanticOnly = await clusterKeywordsByEmbedding(keywords, { provider: 'ollama', ollamaModel: 'fixture', threshold: 0.5, fetchImpl: fetchFixture() });
    const withSerp = await clusterKeywordsByEmbedding(keywords, {
      provider: 'ollama', ollamaModel: 'fixture', threshold: 0.5, fetchImpl: fetchFixture(),
      serpSnapshots: [snapshot('alpha', 'https://example.test/shared'), snapshot('beta', 'https://example.test/shared'), snapshot('gamma', 'https://other.test/gamma')],
    });
    expect(semanticOnly.clusters).toEqual([]);
    expect(semanticOnly.unclusteredKeywords).toEqual(keywords);
    expect(withSerp.clusters[0].keywords).toEqual(['alpha', 'beta']);
    expect(withSerp.unclusteredKeywords).toEqual(['gamma']);
    expect(withSerp.scoringMode).toBe('embedding-serp');
    expect(withSerp.pairEvidence?.find((pair) => pair.keywordA === 'alpha' && pair.keywordB === 'beta')).toMatchObject({ mode: 'hybrid', sharedUrls: ['https://example.test/shared'] });
    expect(embeddingClusteringResultSchema.parse(withSerp)).toEqual(withSerp);
  });

  it('keeps semantic grouping when the imported SERP source is partial', async () => {
    const result = await clusterKeywordsByEmbedding(['alpha', 'beta'], {
      provider: 'ollama', ollamaModel: 'fixture', threshold: 0.35, fetchImpl: fetchFixture(),
      serpSnapshots: [snapshot('alpha', 'https://example.test/shared', 'partial'), snapshot('beta', 'https://example.test/shared')],
    });
    expect(result.clusters[0].keywords).toEqual(['alpha', 'beta']);
    expect(result.pairEvidence?.[0]).toMatchObject({ mode: 'semantic-only', serpJaccard: null });
    expect(result.pairEvidence?.[0].reasons).toContain('serp-a-partial');
  });

  it('preserves original keywords when an Ollama label is generated', async () => {
    const result = await clusterKeywordsByEmbedding(['Alpha SEO', 'Beta SEO'], {
      provider: 'ollama', ollamaModel: 'fixture', labelModel: 'labeler', threshold: 0.5, fetchImpl: fetchFixture(true),
    });
    expect(result.clusters[0]).toMatchObject({ keywords: ['Alpha SEO', 'Beta SEO'], label: 'Generated group label' });
    expect(result.unclusteredKeywords).toEqual([]);
  });
});
