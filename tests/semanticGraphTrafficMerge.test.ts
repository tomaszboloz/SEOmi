import { describe, expect, it } from 'vitest';
import { mergeGscPageRows } from '@/services/semanticGraph/trafficMerge';

describe('mergeGscPageRows', () => {
  it('sums clicks and impressions, recomputes CTR, weights position', () => {
    expect(mergeGscPageRows({ clicks: 10, impressions: 100, ctr: 0.1, position: 2 }, { clicks: 5, impressions: 50, ctr: 0.1, position: 3 }))
      .toEqual({ clicks: 15, impressions: 150, ctr: 0.1, position: 2.33 });
  });
  it('handles zero impressions and null metrics', () => {
    expect(mergeGscPageRows({ clicks: 0, impressions: 0, ctr: 0, position: 2 }, { clicks: 0, impressions: 0, ctr: 0, position: 4 }))
      .toEqual({ clicks: 0, impressions: 0, ctr: 0, position: 3 });
    expect(mergeGscPageRows({ clicks: null, impressions: null, ctr: null, position: null }, { clicks: 1, impressions: 2, ctr: 0.5, position: 1 }))
      .toEqual({ clicks: 1, impressions: 2, ctr: 0.5, position: 1 });
  });
});
