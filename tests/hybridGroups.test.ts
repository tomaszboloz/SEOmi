import { describe, expect, it } from 'vitest';
import { hybridKeywordGroups } from '@/services/embeddings/hybridGroups';
import { hybridPairEvidenceSchema } from '@/services/embeddings/hybridResultSchema';
import type { SerpSnapshot, SerpSource } from '@/services/serpImport/contracts';

const source = (overrides: Partial<SerpSource> = {}): SerpSource => ({
  kind: 'json-import', provider: 'free-serp', sourceUrl: 'https://source.test/export', countryCode: 'PL', locationCode: 2616,
  languageCode: 'pl', capturedAt: '2026-10-06T10:00:00Z', retrievedAt: '2026-10-06T10:01:00Z', availability: 'complete', reason: null, ...overrides,
});
const snapshot = (keyword: string, urls: string[], sourceOverrides: Partial<SerpSource> = {}): SerpSnapshot => ({
  keyword, urls, rows: urls.map((url, index) => ({ rank: index + 1, url })), source: source(sourceOverrides),
});
const vector = (x: number, y: number): Float64Array => Float64Array.from([x, y]);

describe('hybrid keyword groups', () => {
  it('keeps finite unit centroids for extreme finite vector magnitudes', () => {
    for (const magnitude of [Number.MAX_VALUE, Number.MIN_VALUE]) {
      const result = hybridKeywordGroups(['a', 'b'], [vector(magnitude, magnitude), vector(magnitude, magnitude)], [], 0.9);
      expect(result.clusters[0].members).toEqual([0, 1]);
      expect(Array.from(result.clusters[0].centroid)).toEqual([expect.closeTo(Math.SQRT1_2), expect.closeTo(Math.SQRT1_2)]);
    }
    const opposite = hybridKeywordGroups(['a', 'b'], [vector(1, 0), vector(-1, 0)], [], -1);
    expect(Array.from(opposite.clusters[0].centroid)).toEqual([0, 0]);
  });
  it('builds transitive connected components and keeps singletons explicit', () => {
    const result = hybridKeywordGroups(['a', 'b', 'c', 'solo'], [vector(1, 0), vector(1, 1), vector(0, 1), vector(-1, 0)], [], 0.7);
    expect(result.clusters.map((cluster) => cluster.members)).toEqual([[0, 1, 2], [3]]);
    expect(result.pairEvidence.map(({ keywordA, keywordB }) => [keywordA, keywordB])).toEqual([['a', 'b'], ['b', 'c']]);
    expect(result.pairEvidence.every((pair) => pair.mode === 'semantic-only' && pair.serpJaccard === null)).toBe(true);
  });

  it('keeps complete source metadata in evidence and validates the persisted contract', () => {
    const result = hybridKeywordGroups(['alpha', 'beta'], [vector(1, 0), vector(0.4, 0.916515)], [
      snapshot('alpha', ['https://example.test/a', 'https://example.test/shared']),
      snapshot('beta', ['https://example.test/shared', 'https://example.test/b']),
    ], 0.35);
    expect(result.clusters[0].members).toEqual([0, 1]);
    const pair = result.pairEvidence[0];
    expect(pair).toMatchObject({ mode: 'hybrid', sharedUrls: ['https://example.test/shared'], sourceA: { provider: 'free-serp', countryCode: 'PL' }, sourceB: { locationCode: 2616, languageCode: 'pl' } });
    expect(hybridPairEvidenceSchema.parse(pair)).toEqual(pair);
    expect(() => hybridPairEvidenceSchema.parse({ ...pair, sourceA: { ...pair.sourceA, availability: 'not-a-status' } })).toThrow();
  });

  it('falls back to semantic scoring for partial SERP evidence and missing snapshots', () => {
    const partial = hybridKeywordGroups(['alpha', 'beta'], [vector(1, 0), vector(0.4, 0.916515)], [
      snapshot('alpha', ['https://example.test/shared'], { availability: 'partial' }), snapshot('beta', ['https://example.test/shared']),
    ], 0.35);
    expect(partial.pairEvidence[0]).toMatchObject({ mode: 'semantic-only', serpJaccard: null, score: expect.closeTo(0.4, 5) });
    const missing = hybridKeywordGroups(['alpha', 'beta'], [vector(1, 0), vector(0.4, 0.916515)], [], 0.35);
    expect(missing.pairEvidence[0]).toMatchObject({ mode: 'semantic-only', serpJaccard: null, reasons: ['serp-snapshot-missing'] });
  });

  it('bounds the hybrid input to two hundred keywords before pair expansion', () => {
    const keywords = Array.from({ length: 201 }, (_, index) => `keyword-${index}`);
    const vectors = keywords.map(() => vector(1, 0));
    expect(() => hybridKeywordGroups(keywords, vectors, [], 0.5)).toThrow(/Too many hybrid keywords/);
  });
});
