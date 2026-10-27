import { describe, expect, it } from 'vitest';
import {
  clusterKeywordPairs, MAX_HYBRID_KEYWORDS, MAX_HYBRID_VECTOR_DIMENSIONS, scoreHybridPair,
  semanticCosine, serpJaccard, validateHybridWeights,
} from '@/services/embeddings/hybridSerp';
import type { SerpSnapshot } from '@/services/serpImport/contracts';

const source = (overrides: Partial<SerpSnapshot['source']> = {}): SerpSnapshot['source'] => ({
  kind: 'json-import', provider: 'free', sourceUrl: null, countryCode: 'PL', locationCode: 2616,
  languageCode: 'pl', capturedAt: null, retrievedAt: null, availability: 'complete', reason: null, ...overrides,
});
const snapshot = (urls: string[], sourceOverrides: Partial<SerpSnapshot['source']> = {}, keyword = 'query'): SerpSnapshot => ({
  keyword, rows: urls.map((url, index) => ({ rank: index + 1, url })), urls, source: source(sourceOverrides),
});

describe('hybrid embedding and SERP evidence', () => {
  it('keeps semantic cosine independent and combines compatible complete SERP evidence', () => {
    const result = scoreHybridPair({ keyword: 'a', vector: [1, 0], snapshot: snapshot(['https://a.test', 'https://b.test'], {}, 'a') }, { keyword: 'b', vector: [1, 1], snapshot: snapshot(['https://b.test', 'https://c.test'], {}, 'b') });
    expect(result.semanticCosine).toBeCloseTo(Math.SQRT1_2);
    expect(result.serpJaccard).toBeCloseTo(1 / 3);
    expect(result.score).toBeCloseTo(Math.SQRT1_2 * 0.7 + (1 / 3) * 0.3);
    expect(result).toMatchObject({ mode: 'hybrid', sharedUrls: ['https://b.test'], reasons: ['serp-compatible'], weights: { semantic: 0.7, serp: 0.3 }, sourceA: expect.objectContaining({ countryCode: 'PL' }), sourceB: expect.objectContaining({ languageCode: 'pl' }) });
  });

  it.each(['partial', 'blocked', 'missing'] as const)('uses semantic-only mode for %s SERP sources without a false zero', (availability) => {
    const result = scoreHybridPair({ keyword: 'a', vector: [1, 0], snapshot: snapshot(['https://a.test'], { availability, reason: 'unavailable' }, 'a') }, { keyword: 'b', vector: [1, 1], snapshot: snapshot(['https://a.test'], {}, 'b') });
    expect(result.mode).toBe('semantic-only'); expect(result.serpJaccard).toBeNull(); expect(result.score).toBeCloseTo(Math.SQRT1_2);
    expect(result.reasons).toContain(`serp-a-${availability}`); expect(result.sharedUrls).toEqual([]);
  });

  it('requires compatible market metadata and returns null when no complete SERP results exist', () => {
    const a = snapshot([], {}, 'a'); const b = snapshot([], { languageCode: 'en' }, 'b');
    expect(serpJaccard(a, b)).toBeNull();
    expect(scoreHybridPair({ keyword: 'a', vector: [1, 0] }, { keyword: 'b', vector: [0, 1] }).reasons).toEqual(['serp-snapshot-missing']);
    expect(scoreHybridPair({ keyword: 'a', vector: [1, 0], snapshot: a }, { keyword: 'b', vector: [0, 1], snapshot: b }).reasons).toEqual(['serp-context-incompatible']);
    expect(scoreHybridPair({ keyword: 'a', vector: [1, 0], snapshot: a }, { keyword: 'b', vector: [1, 0], snapshot: snapshot([], {}, 'b') }).reasons).toEqual(['serp-no-results']);
  });

  it('clusters pair evidence over the configured score threshold', () => {
    const result = clusterKeywordPairs([[1, 0], [1, 0], [0, 1]], ['a', 'b', 'c'], [null, null, null], 0.9);
    expect(result.map(({ keywordA, keywordB }) => [keywordA, keywordB])).toEqual([['a', 'b']]);
    expect(() => clusterKeywordPairs([[1]], [], [], 0)).toThrow(/equal lengths/);
    expect(() => clusterKeywordPairs([], [], [], NaN)).toThrow(/finite/);
    expect(() => clusterKeywordPairs(Array.from({ length: MAX_HYBRID_KEYWORDS + 1 }, () => [1]), Array.from({ length: MAX_HYBRID_KEYWORDS + 1 }, (_, i) => String(i)), Array.from({ length: MAX_HYBRID_KEYWORDS + 1 }, () => null), 0)).toThrow(/Too many/);
  });

  it('validates direct math, weights, vector bounds and snapshot bounds', () => {
    expect(semanticCosine(new Float64Array([1, 0]), [0, 1])).toBe(0);
    expect(validateHybridWeights()).toEqual({ semantic: 0.7, serp: 0.3 });
    expect(() => validateHybridWeights({ semantic: Infinity })).toThrow(/finite/);
    expect(() => validateHybridWeights({ semantic: 0, serp: 0 })).toThrow(/non-zero/);
    expect(() => semanticCosine([0], [1])).toThrow(/zero/);
    expect(() => semanticCosine([Infinity], [1])).toThrow(/finite/);
    expect(() => semanticCosine([1], [1, 0])).toThrow(/dimensions differ/);
    expect(semanticCosine([1e308, 1e308], [1e308, -1e308])).toBeCloseTo(0);
    expect(() => validateHybridWeights({ semantic: 1e308, serp: 1e308 })).toThrow(/finite/);
    expect(() => semanticCosine(Array.from({ length: MAX_HYBRID_VECTOR_DIMENSIONS + 1 }, () => 1), [1])).toThrow(/oversized/);
    const tooMany = snapshot(Array.from({ length: 11 }, (_, index) => `https://x.test/${index}`));
    expect(() => serpJaccard(tooMany, snapshot([]))).toThrow(/at most/);
    expect(() => serpJaccard(snapshot(['']), snapshot([]))).toThrow(/bounded/);
    expect(() => scoreHybridPair({ keyword: 'a', vector: [1], snapshot: snapshot([], {}) }, { keyword: 'b', vector: [1] })).toThrow(/does not match/);
    expect(() => scoreHybridPair({ keyword: '', vector: [1] }, { keyword: 'b', vector: [1] })).toThrow(/non-empty/);
  });
});
