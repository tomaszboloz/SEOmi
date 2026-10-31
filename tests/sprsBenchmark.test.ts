import { expect, it, vi } from 'vitest';
import { runSprsBenchmark, syntheticSprsGraph } from '@/services/semanticGraph/sprsBenchmark';
import { computeSprs } from '@/services/semanticGraph/sprs';

it('builds the same synthetic graph for the same seed and rejects invalid sizes', () => {
  const first = syntheticSprsGraph(50, 200, 7);
  expect(syntheticSprsGraph(50, 200, 7)).toEqual(first);
  expect(syntheticSprsGraph(50, 200, 8).edges).not.toEqual(first.edges);
  expect(first.nodes).toHaveLength(50);
  expect(first.edges.every((edge) => Number(edge.target.slice(1)) < 50)).toBe(true);
  expect(syntheticSprsGraph(3, 0, 0).edges).toEqual([]);
  expect(() => syntheticSprsGraph(0, 1)).toThrow(TypeError);
  expect(() => syntheticSprsGraph(1.5, 1)).toThrow(TypeError);
  expect(() => syntheticSprsGraph(2, -1)).toThrow(TypeError);
});

it('reports time, heap delta and convergence of a cold solve', () => {
  const clock = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(35);
  const result = runSprsBenchmark(200, 1_000, clock);
  expect(result).toMatchObject({ pages: 200, edges: 1_000, ms: 25, converged: true });
  expect(result.iterations).toBeGreaterThan(0);
  expect(typeof result.heapDeltaMb).toBe('number');
  const memoryUsage = process.memoryUsage;
  Object.defineProperty(process, 'memoryUsage', { value: undefined, configurable: true });
  try {
    expect(runSprsBenchmark(5, 5).heapDeltaMb).toBeNull();
  } finally {
    Object.defineProperty(process, 'memoryUsage', { value: memoryUsage, configurable: true });
  }
});

it('scores 150 000 pages without overflowing the call stack', () => {
  const graph = syntheticSprsGraph(150_000, 150_000);
  const report = computeSprs(graph.nodes, graph.edges);
  expect(report.pages).toHaveLength(150_000);
  expect(report.pages[0].score).toBe(100);
  const total = report.pages.reduce((sum, page) => sum + page.probability, 0);
  expect(total).toBeCloseTo(1, 6);
}, 60_000);

// Full GEM-71-10 profile (50 000 URLs, 2 000 000 edges). Opt-in: `npm run bench:sprs`.
it.runIf(process.env.SPRS_BENCH === '1')('benchmark: 50 000 pages and 2 000 000 edges', () => {
  const result = runSprsBenchmark(50_000, 2_000_000);
  process.stderr.write(`${JSON.stringify({ ...result, node: process.version, arch: process.arch, platform: process.platform })}\n`);
  expect(result.converged).toBe(true);
}, 600_000);
