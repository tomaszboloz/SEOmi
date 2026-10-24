import type { EmbeddingClusteringResult } from '@/services/embeddingClustering';
import type { SerpSnapshot as ImportedSnapshot } from '@/services/serpImport';
import type { SerpSnapshot } from '@/services/semanticDecay/types';

export const historySnapshot = (index = 0, patch: Partial<SerpSnapshot> = {}): SerpSnapshot => ({
  id: `snapshot-${index}`, takenAt: new Date(Date.UTC(2026, 9, 1 + index)).toISOString(),
  query: 'query', country: 'PL', language: 'pl', provider: 'fixture', model: 'fixture-model',
  profile: 'fixture-profile', k: 10, centroid: new Float64Array([1, 0]),
  consensusEntities: ['entity'], dominantIntent: 'informational', dominantFormat: 'guide',
  docs: [{ url: 'https://example.test/observed', rank: 2 }], ...patch,
});

export const hybridRun = (patch: Partial<EmbeddingClusteringResult> = {}): EmbeddingClusteringResult => ({
  method: 'embeddings', provider: 'local', model: 'fixture-model', threshold: 0.5,
  clusters: [], unclusteredKeywords: ['query', 'other'], analyzedAt: '2026-10-24T12:00:00.000Z',
  scoringMode: 'embedding-serp', pairEvidence: [], ...patch,
});

export const importedSnapshot = (patch: Partial<ImportedSnapshot['source']> = {}, keyword = 'query'): ImportedSnapshot => ({
  keyword, rows: [{ url: 'https://example.test/observed', rank: 2 }], urls: ['https://example.test/observed'],
  source: {
    kind: 'json-import', provider: 'fixture', sourceUrl: null, countryCode: 'PL', languageCode: 'pl', locationCode: 2616,
    capturedAt: '2026-10-01T12:00:00.000Z', retrievedAt: '2026-10-02T12:00:00.000Z', availability: 'complete', reason: null, ...patch,
  },
});
