import { describe, expect, it } from 'vitest';
import { clusterByAverageLinkage, MIN_TOPIC_SIMILARITY } from '../src/services/semanticGraph/clustering';

describe('average-linkage public contract', () => {
  it('preserves isolated pages and the empty graph', () => {
    expect(clusterByAverageLinkage(0, [])).toEqual([]);
    expect(clusterByAverageLinkage(4, [])).toEqual([0, 1, 2, 3]);
  });

  it('includes the exact topic floor and rejects a lower similarity', () => {
    expect(clusterByAverageLinkage(3, [
      { left: 0, right: 1, similarity: MIN_TOPIC_SIMILARITY },
      { left: 1, right: 2, similarity: MIN_TOPIC_SIMILARITY - 0.001 },
    ])).toEqual([0, 0, 2]);
  });

  it('counts missing pair evidence as zero instead of chaining topics', () => {
    expect(clusterByAverageLinkage(3, [
      { left: 0, right: 1, similarity: 0.3 },
      { left: 1, right: 2, similarity: 0.3 },
    ])).toEqual([0, 0, 2]);
  });

  it('recomputes group averages and returns the lowest page as root', () => {
    expect(clusterByAverageLinkage(4, [
      { left: 0, right: 1, similarity: 0.8 },
      { left: 2, right: 3, similarity: 0.9 },
      { left: 0, right: 2, similarity: 0.2 },
      { left: 1, right: 2, similarity: 0.2 },
      { left: 0, right: 3, similarity: 0.2 },
      { left: 1, right: 3, similarity: 0.2 },
    ])).toEqual([0, 0, 0, 0]);
  });

  it('breaks equal-score ties deterministically regardless of input order', () => {
    const pairs = [
      { left: 0, right: 1, similarity: 0.3 },
      { left: 1, right: 2, similarity: 0.3 },
    ];
    expect(clusterByAverageLinkage(3, pairs)).toEqual([0, 0, 2]);
    expect(clusterByAverageLinkage(3, [...pairs].reverse())).toEqual([0, 0, 2]);
  });
});
