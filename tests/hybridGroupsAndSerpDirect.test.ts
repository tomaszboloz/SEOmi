import { describe, expect, it } from 'vitest';
import { hybridKeywordGroups } from '@/services/embeddings/hybridGroups';
import {
  semanticCosine,
  validateHybridWeights,
  serpJaccard,
  scoreHybridPair,
  clusterKeywordPairs,
} from '@/services/embeddings/hybridSerp';
import type { SerpSnapshot } from '@/services/serpImport';

describe('hybridGroups and hybridSerp direct contracts', () => {
  const dummySnapshot = (keyword: string, urls: string[]): SerpSnapshot => ({
    keyword,
    source: {
      kind: 'json-import',
      provider: 'dataforseo',
      sourceUrl: null,
      countryCode: 'US',
      locationCode: 2840,
      languageCode: 'en',
      capturedAt: null,
      retrievedAt: null,
      availability: 'complete',
      reason: null,
    },
    rows: urls.map((url, i) => ({ rank: i + 1, url, title: `Title ${i}` })),
    urls,
  });

  it('clusters keywords into connected components with centroids and pair evidence', () => {
    const keywords = ['seo audit', 'site audit', 'page speed'];
    const vectors = [
      new Float64Array([1, 0, 0]),
      new Float64Array([0.9, 0.1, 0]),
      new Float64Array([0, 0, 1]),
    ];
    const snapshots = [
      dummySnapshot('seo audit', ['https://a.test', 'https://b.test']),
      dummySnapshot('site audit', ['https://a.test', 'https://c.test']),
      dummySnapshot('page speed', ['https://d.test']),
    ];

    const result = hybridKeywordGroups(keywords, vectors, snapshots, 0.5);
    expect(result.clusters.length).toBeGreaterThanOrEqual(1);
    expect(result.pairEvidence.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects duplicate normalized keywords in hybridKeywordGroups', () => {
    const keywords = ['seo audit', '  SEO   AUDIT '];
    const vectors = [new Float64Array([1, 0]), new Float64Array([1, 0])];
    const snapshots: SerpSnapshot[] = [];
    expect(() => hybridKeywordGroups(keywords, vectors, snapshots, 0.5)).toThrow('Hybrid keywords must be distinct');
  });

  it('rejects misaligned or invalid vectors before building centroids', () => {
    expect(() => hybridKeywordGroups(['a', 'b'], [new Float64Array([1, 0])], [], 0.5)).toThrow('equal lengths');
    expect(() => hybridKeywordGroups(['a'], [new Float64Array([0, 0])], [], 0.5)).toThrow('zero');
    expect(() => hybridKeywordGroups(['a', 'b'], [new Float64Array([1, 0]), new Float64Array([1, 0])], [dummySnapshot('a', []), dummySnapshot(' A ', [])], 0.5)).toThrow('distinct keywords');
  });

  it('computes semanticCosine with proper normalization and error handling', () => {
    expect(semanticCosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(semanticCosine([1, 1], [1, 1])).toBeCloseTo(1);
    expect(() => semanticCosine([], [1])).toThrow('Invalid or oversized embedding vector');
    expect(() => semanticCosine([NaN], [1])).toThrow('Embedding vectors must contain finite numbers');
    expect(() => semanticCosine([0, 0], [1, 1])).toThrow('Embedding vectors must not be zero vectors');
    expect(() => semanticCosine([1, 0], [1, 0, 0])).toThrow('Vector dimensions differ');
  });

  it('validates hybrid weights correctly', () => {
    expect(validateHybridWeights()).toEqual({ semantic: 0.7, serp: 0.3 });
    expect(validateHybridWeights({ semantic: 0.5, serp: 0.5 })).toEqual({ semantic: 0.5, serp: 0.5 });
    expect(() => validateHybridWeights({ semantic: -1 })).toThrow();
    expect(() => validateHybridWeights({ semantic: 0, serp: 0 })).toThrow();
    expect(() => validateHybridWeights({ semantic: Infinity })).toThrow();
  });

  it('computes serpJaccard and handles incompatible or missing contexts', () => {
    const snap1 = dummySnapshot('alpha', ['https://a.test', 'https://b.test']);
    const snap2 = dummySnapshot('beta', ['https://b.test', 'https://c.test']);
    expect(serpJaccard(snap1, snap2)).toBeCloseTo(1 / 3);

    const incompatibleSnap = {
      ...snap2,
      source: { ...snap2.source, locationCode: 9999 },
    };
    expect(serpJaccard(snap1, incompatibleSnap)).toBeNull();
  });

  it('scores hybrid pairs and checks length mismatch in clusterKeywordPairs', () => {
    const pairScore = scoreHybridPair(
      { keyword: 'alpha', vector: [1, 0], snapshot: null },
      { keyword: 'beta', vector: [0, 1], snapshot: null },
    );
    expect(pairScore.mode).toBe('semantic-only');
    expect(pairScore.score).toBeCloseTo(0);

    expect(() => clusterKeywordPairs([[1]], ['alpha'], [], 0.5)).toThrow('Vectors, keywords and snapshots must have equal lengths');
    expect(() => clusterKeywordPairs([[1]], ['alpha'], [null], 2)).toThrow('Hybrid threshold must be finite and within [-1, 1]');
  });
});
