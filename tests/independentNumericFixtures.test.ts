import { describe, expect, it } from 'vitest';
import { computeTbva } from '@/services/offPage/tbva';
import { compareSnapshots } from '@/services/semanticDecay/compare';
import type { SerpSnapshot } from '@/services/semanticDecay/types';
import { holmAdjust } from '@/services/experiments/causalPolicy';

/**
 * Independent numeric fixtures (#90 GEM-90-02). Expected values are worked out by hand in the comments,
 * not copied from the implementation.
 */
const v = (...values: number[]) => Float64Array.from(values);

describe('hand-computed fixtures (#90 GEM-90-02)', () => {
  it('TBVA: one best link per domain, nofollow excluded', () => {
    // a.pl: 80/100 * cos([1,0],[1,0]) = 0.8 (beats the second a.pl link 0.4); b.pl: 50/100 * 0.6 = 0.3. Sum 1.1.
    const report = computeTbva([
      { sourceUrl: 'https://a.pl/1', authority: 80, follow: true, vector: v(1, 0) },
      { sourceUrl: 'https://www.a.pl/2', authority: 40, follow: true, vector: v(1, 0) },
      { sourceUrl: 'https://b.pl/x', authority: 50, follow: true, vector: v(0.6, 0.8) },
      { sourceUrl: 'https://c.pl/x', authority: 100, follow: false, vector: v(1, 0) },
    ], { scale: 100, topic: v(1, 0) });
    expect(report).toMatchObject({ status: 'ready', tbva: 1.1, counted: 2, duplicateDomains: 1, nofollow: 1, coverage: 1 });
  });

  it('TBVA: negative cosine contributes 0 and a missing vector makes the result partial', () => {
    // a.pl: 1.0 * max(0, -1) = 0; b.pl unscored. TBVA 0, coverage 1/2.
    const report = computeTbva([
      { sourceUrl: 'https://a.pl', authority: 100, follow: true, vector: v(-1, 0) },
      { sourceUrl: 'https://b.pl', authority: 100, follow: true, vector: null },
    ], { scale: 100, topic: v(1, 0) });
    expect(report).toMatchObject({ status: 'partial', tbva: 0, coverage: 0.5 });
  });

  it('Decay Radar centroid shift is 1 - cosine', () => {
    // cos([1,0],[0.6,0.8]) = 0.6, shift 0.4.
    const snap = (id: string, centroid: Float64Array): SerpSnapshot => ({ id, takenAt: id, query: 'q', country: 'PL', language: 'pl', provider: 'p', model: 'm', profile: 'x', k: 10,
      centroid, consensusEntities: [], dominantIntent: null, dominantFormat: null, docs: [{ url: 'https://a.pl', rank: 1 }] });
    expect(compareSnapshots(snap('1', v(1, 0)), snap('2', v(0.6, 0.8))).centroidShift).toBeCloseTo(0.4, 12);
  });

  it('Holm adjustment for p = 0.01, 0.02, 0.03', () => {
    // sorted: 3*0.01 = 0.03, 2*0.02 = 0.04, 1*0.03 = 0.03 -> monotone 0.04.
    expect(holmAdjust([0.03, 0.01, 0.02]).map((r) => r.adjustedP)).toEqual([0.04, 0.03, 0.04]);
  });
});
