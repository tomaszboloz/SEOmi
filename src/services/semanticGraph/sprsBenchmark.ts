import type { PageRankNode } from './pageRank';
import { computeSprs, type SprsEdge } from './sprs';

/** Deterministic synthetic site: every page links to `perPage` others, some with known similarity. */
export const syntheticSprsGraph = (pages: number, edges: number, seed = 1): { nodes: PageRankNode[]; edges: SprsEdge[] } => {
  if (!Number.isSafeInteger(pages) || !Number.isSafeInteger(edges) || pages < 1 || edges < 0) {
    throw new TypeError('pages must be a positive integer and edges a non-negative integer');
  }
  let state = seed >>> 0 || 1;
  // xorshift32: reproducible without Math.random, so two runs measure the same graph.
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
  const nodes = Array.from({ length: pages }, (_, index) => ({ id: `p${index}` }));
  const list: SprsEdge[] = new Array(edges);
  for (let index = 0; index < edges; index += 1) {
    const source = index % pages;
    // Skewed targets (hubs get more links), as on real sites.
    const target = Math.floor(next() ** 2 * pages);
    list[index] = { source: `p${source}`, target: `p${target}`, weight: next() < 0.6 ? 0.25 : 1, similarity: next() < 0.5 ? next() : undefined };
  }
  return { nodes, edges: list };
};

export interface SprsBenchmarkResult {
  pages: number;
  edges: number;
  ms: number;
  heapDeltaMb: number | null;
  converged: boolean;
  iterations: number;
  residual: number;
}

const heapMb = (): number | null => {
  const usage = (globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } }).process?.memoryUsage?.();
  return usage ? usage.heapUsed / 1_048_576 : null;
};

/** Times one cold SPRS solve over a synthetic graph; heap delta is null where the runtime cannot report it. */
export const runSprsBenchmark = (pages: number, edges: number, now: () => number = () => performance.now()): SprsBenchmarkResult => {
  const graph = syntheticSprsGraph(pages, edges);
  const heapBefore = heapMb();
  const started = now();
  const report = computeSprs(graph.nodes, graph.edges);
  const ms = now() - started;
  const heapAfter = heapMb();
  return {
    pages, edges, ms,
    heapDeltaMb: heapBefore === null || heapAfter === null ? null : heapAfter - heapBefore,
    converged: report.converged, iterations: report.iterations, residual: report.residual,
  };
};
