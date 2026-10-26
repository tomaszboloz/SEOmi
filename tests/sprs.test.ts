import { describe, expect, it } from 'vitest';
import { computeSprs, simulateWhatIf } from '@/services/semanticGraph/sprs';

const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

describe('sprs', () => {
  it('is unavailable without nodes', () => {
    expect(computeSprs([], []).status).toBe('unavailable');
  });
  it('flags dead ends, under-linked pages and leaks', () => {
    const r = computeSprs(nodes, [
      { source: 'a', target: 'b' }, { source: 'c', target: 'b' }, { source: 'a', target: 'a' }, { source: 'a', target: 'c', weight: 2 },
      { source: 'd', target: 'b', similarity: 0.01 }, { source: 'd', target: 'c', links: 2, similarity: 0.9 },
      { source: 'c', target: 'a', similarity: 0.02 },
    ]);
    const by = Object.fromEntries(r.pages.map((p) => [p.nodeId, p]));
    expect(r.status).toBe('ready');
    expect(r.converged).toBe(true);
    expect(Math.max(...r.pages.map((p) => p.score))).toBe(100);
    expect(by.b.deadEnd).toBe(true);
    expect(by.a.deadEnd).toBe(false);
    const star = computeSprs(['h', 'x', 'y', 'z', 'w'].map((id) => ({ id })), ['x', 'y', 'z', 'w'].map((source) => ({ source, target: 'h' })).concat([{ source: 'h', target: 'x' }]));
    expect(star.pages.find((p) => p.nodeId === 'w')?.underLinked).toBe(true);
    expect(by.b.underLinked).toBe(false);
    expect(by.d.leak).toBe(false);
    expect(by.c.leak).toBe(true);
    expect(by.d.outDegree).toBe(2);
    expect(by.b.inDegree).toBe(3);
    expect(r.unknownSimilarityEdges).toBe(3);
    const leaky = computeSprs(nodes, [{ source: 'a', target: 'b', similarity: 0 }]);
    expect(leaky.pages.find((p) => p.nodeId === 'a')?.leak).toBe(true);
  });
  it('simulates what-if without mutating inputs', () => {
    const edges = [{ source: 'a', target: 'b' }];
    const copy = JSON.stringify(edges);
    const rows = simulateWhatIf(nodes, edges, { add: [{ source: 'a', target: 'c' }, { source: 'b', target: 'c' }], remove: [{ source: 'a', target: 'b' }] });
    expect(JSON.stringify(edges)).toBe(copy);
    expect(rows.find((r) => r.nodeId === 'c')?.delta).toBeGreaterThan(0);
    expect(rows.find((r) => r.nodeId === 'b')?.delta).toBeLessThan(0);
    expect(simulateWhatIf(nodes, edges, {})).toEqual([]);
    expect(simulateWhatIf(nodes, [{ source: 'a', target: 'b' }, { source: 'c', target: 'd' }], { add: [{ source: 'b', target: 'a' }, { source: 'd', target: 'a' }] }).length).toBeGreaterThan(0);
  });
});
