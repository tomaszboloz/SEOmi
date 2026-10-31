// @vitest-environment node
import { expect, it } from 'vitest';
import { computeSprs, simulateWhatIfRun, sprsTolerance } from '@/services/semanticGraph/sprs';

/** GEM-71-10: a sparse 20k-page / 200k-link graph stays well within interactive limits. */
it('solves a large sparse graph and a warm-started What-If', () => {
  const n = 20_000;
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
  const edges = [];
  for (let i = 0; i < n; i += 1) for (let k = 1; k <= 10; k += 1) edges.push({ source: `p${i}`, target: `p${(i * 7 + k * 131) % n}` });
  const started = performance.now();
  const report = computeSprs(nodes, edges);
  const cold = performance.now() - started;
  expect(report.converged).toBe(true);
  expect(report.pages.reduce((sum, page) => sum + page.probability, 0)).toBeCloseTo(1, 6);
  const run = simulateWhatIfRun(nodes, edges, { add: [{ source: 'p1', target: 'p2' }] });
  expect(run.issues).toEqual([]);
  expect(cold).toBeLessThan(15_000);
}, 60_000);

it('sprsTolerance keeps 1e-6 up to 10k pages and tightens above', () => {
  expect(sprsTolerance(0)).toBe(1e-6);
  expect(sprsTolerance(10_000)).toBe(1e-6);
  expect(sprsTolerance(100_000)).toBeCloseTo(1e-7, 12);
});
