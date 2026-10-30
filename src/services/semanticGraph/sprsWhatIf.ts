import type { PageRankNode } from './pageRank';
import { computeSprs, type SprsEdge } from './sprs';

export interface EdgeRef { source: string; target: string }

export interface WhatIfChange {
  add?: SprsEdge[];
  remove?: EdgeRef[];
  /** New positive weight for an existing edge. */
  update?: Array<EdgeRef & { weight: number }>;
}

export type WhatIfIssue = 'unknown-node' | 'self-link' | 'duplicate-edge' | 'missing-edge' | 'invalid-weight';

/** `after` and `delta` use the baseline reference: 100 = the best page before the change (GEM-71-08). */
export interface WhatIfRow { nodeId: string; before: number; after: number; delta: number }

export interface WhatIfResult {
  rows: WhatIfRow[];
  /** Solver state of the simulated graph, warm-started from the current ranks. */
  converged: boolean;
  iterations: number;
  residual: number;
  /** Rejected change; nothing was simulated when this is not empty. */
  issues: WhatIfIssue[];
  /** True when the solver hit its limit, so deltas are approximate. */
  uncertain: boolean;
}

const key = (ref: EdgeRef): string => `${ref.source}\u0000${ref.target}`;
const validWeight = (value: number | undefined): boolean => value === undefined || (Number.isFinite(value) && value > 0);

/** GEM-71-07: unknown ids, self links, duplicates, missing edges and bad weights reject the change. */
export const validateWhatIf = (nodes: PageRankNode[], edges: SprsEdge[], change: WhatIfChange): WhatIfIssue[] => {
  const ids = new Set(nodes.map((node) => node.id));
  const existing = new Set(edges.map(key));
  const issues = new Set<WhatIfIssue>();
  const refs = [...(change.add ?? []), ...(change.remove ?? []), ...(change.update ?? [])];
  if (refs.some((ref) => !ids.has(ref.source) || !ids.has(ref.target))) issues.add('unknown-node');
  if (refs.some((ref) => ref.source === ref.target)) issues.add('self-link');
  const added = (change.add ?? []).map(key);
  if (added.some((id, i) => existing.has(id) || added.indexOf(id) !== i)) issues.add('duplicate-edge');
  if ([...(change.remove ?? []), ...(change.update ?? [])].some((ref) => !existing.has(key(ref)))) issues.add('missing-edge');
  if ((change.add ?? []).some((edge) => !validWeight(edge.weight) || !validWeight(edge.links))
    || (change.update ?? []).some((edge) => !validWeight(edge.weight) || edge.weight === undefined)) issues.add('invalid-weight');
  return [...issues];
};

/** Simulates link changes on a copy, warm-started from the current ranks; the input arrays are never mutated. */
export const simulateWhatIfRun = (nodes: PageRankNode[], edges: SprsEdge[], change: WhatIfChange): WhatIfResult => {
  const issues = validateWhatIf(nodes, edges, change);
  if (issues.length) return { rows: [], converged: false, iterations: 0, residual: Number.NaN, issues, uncertain: true };
  const before = computeSprs(nodes, edges);
  const removed = new Set((change.remove ?? []).map(key));
  const updated = new Map((change.update ?? []).map((ref) => [key(ref), ref.weight]));
  const next = edges.filter((edge) => !removed.has(key(edge)))
    .map((edge) => (updated.has(key(edge)) ? { ...edge, weight: updated.get(key(edge)) } : edge))
    .concat(change.add ?? []);
  const after = computeSprs(nodes, next, new Map(before.pages.map((page) => [page.nodeId, page.probability])));
  const reference = Math.max(...before.pages.map((page) => page.probability), Number.MIN_VALUE);
  const prior = new Map(before.pages.map((page) => [page.nodeId, page.score]));
  const round = (value: number) => Math.round(value * 10) / 10;
  const rows = after.pages
    .map((page) => {
      const was = prior.get(page.nodeId) as number;
      const now = round((page.probability / reference) * 100);
      return { nodeId: page.nodeId, before: was, after: now, delta: round(now - was) };
    })
    .filter((row) => row.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || (a.nodeId < b.nodeId ? -1 : 1));
  return { rows, converged: after.converged, iterations: after.iterations, residual: after.residual, issues: [], uncertain: !after.converged };
};

export const simulateWhatIf = (nodes: PageRankNode[], edges: SprsEdge[], change: WhatIfChange): WhatIfRow[] => simulateWhatIfRun(nodes, edges, change).rows;
