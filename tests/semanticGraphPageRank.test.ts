import { describe, expect, it } from 'vitest';
import { calculatePageRank } from '@/services/semanticGraph/pageRank';

describe('semantic graph PageRank', () => {
  it('normalizes scores and orders ties by node id', () => {
    const result = calculatePageRank([{ id: 'b' }, { id: 'a' }], []);
    expect(result.scores).toEqual([{ nodeId: 'a', score: 0.5 }, { nodeId: 'b', score: 0.5 }]);
    expect(result.scores.reduce((sum, item) => sum + item.score, 0)).toBeCloseTo(1);
    expect(result.converged).toBe(true);
  });

  it('handles a dangling node and converges deterministically', () => {
    const graph = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [{ source: 'a', target: 'b' }];
    const first = calculatePageRank(graph, edges);
    const second = calculatePageRank([...graph].reverse(), [...edges].reverse());
    expect(first).toEqual(second);
    expect(first.scores[0].nodeId).toBe('b');
    expect(first.scores.reduce((sum, item) => sum + item.score, 0)).toBeCloseTo(1);
  });

  it('aggregates weighted links and supports the semantic edge shape', () => {
    const result = calculatePageRank([{ id: 'a' }, { id: 'b' }], [
      { source: 'a', target: 'b', links: 3 }, { source: 'b', target: 'a', weight: 1 },
    ]);
    expect(result.scores[0].score).toBeCloseTo(0.5);
    expect(result.scores[1].score).toBeCloseTo(0.5);
  });

  it('rejects malformed nodes, edges, weights and options', () => {
    expect(() => calculatePageRank([{ id: 'a' }, { id: 'a' }], [])).toThrow(/unique/);
    expect(() => calculatePageRank([{ id: 'a' }], [{ source: 'a', target: 'b' }])).toThrow(/unknown/);
    expect(() => calculatePageRank([{ id: 'a' }], [{ source: 'a', target: 'a', links: 0 }])).toThrow(/weights/);
    expect(() => calculatePageRank([{ id: 'a' }], [], { damping: 1 })).toThrow(/damping/);
    expect(() => calculatePageRank([{ id: 'a' }], [], { tolerance: 0 })).toThrow(/tolerance/);
    expect(() => calculatePageRank([{ id: 'a' }], [], { maxIterations: 0 })).toThrow(/maxIterations/);
  });

  it('reports a bounded run when the iteration limit is reached', () => {
    const result = calculatePageRank([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }], { maxIterations: 1 });
    expect(result.iterations).toBe(1);
    expect(result.converged).toBe(false);
  });

  it('handles empty nodes and invalid node ids', () => {
    expect(calculatePageRank([], [])).toEqual({ scores: [], iterations: 0, converged: true });
    expect(() => calculatePageRank([{ id: '' }], [])).toThrow(/non-empty id/);
    expect(() => calculatePageRank([{ id: '   ' }], [])).toThrow(/non-empty id/);
    expect(() => calculatePageRank([{ id: null as never }], [])).toThrow(/non-empty id/);
  });
});

