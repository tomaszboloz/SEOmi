import { calculatePageRank, type PageRankEdge, type PageRankNode } from './pageRank';

export interface SprsEdge extends PageRankEdge {
  /** Semantic similarity source->target in [0,1]; undefined means unknown (never guessed). */
  similarity?: number;
}

export const SPRS_PROFILE = {
  /** Page is under-linked when its score is below this share of the uniform score 1/n. */
  underLinkedShare: 0.5,
  /** Outgoing edge counts as leaking when similarity is known and below this floor. */
  similarityFloor: 0.05,
  /** Node leaks when at least this share of its outgoing weight is leaking. */
  leakShare: 0.5,
  tolerance: 1e-6,
  maxIterations: 150,
} as const;

export interface SprsPage {
  nodeId: string;
  /** 0-100, scaled so the best page is 100. */
  score: number;
  inDegree: number;
  outDegree: number;
  deadEnd: boolean;
  underLinked: boolean;
  leak: boolean;
}

export interface SprsReport {
  status: 'ready' | 'unavailable';
  pages: SprsPage[];
  converged: boolean;
  iterations: number;
  unknownSimilarityEdges: number;
}

const EMPTY: SprsReport = { status: 'unavailable', pages: [], converged: true, iterations: 0, unknownSimilarityEdges: 0 };

const isSelf = (edge: SprsEdge): boolean => edge.source === edge.target;

/** Self-links are dropped (reason: they pass no authority to other pages). */
const usable = (edges: SprsEdge[]): SprsEdge[] => edges.filter((edge) => !isSelf(edge));

export const computeSprs = (nodes: PageRankNode[], edges: SprsEdge[]): SprsReport => {
  if (!nodes.length) return EMPTY;
  const kept = usable(edges);
  const rank = calculatePageRank(nodes, kept, { tolerance: SPRS_PROFILE.tolerance, maxIterations: SPRS_PROFILE.maxIterations });
  const max = Math.max(...rank.scores.map((row) => row.score));
  const uniform = 1 / nodes.length;
  const out = new Map<string, { total: number; leaking: number; count: number }>();
  const incoming = new Map<string, Set<string>>();
  kept.forEach((edge) => {
    const weight = edge.weight ?? edge.links ?? 1;
    const row = out.get(edge.source) ?? { total: 0, leaking: 0, count: 0 };
    row.total += weight;
    row.count += 1;
    if (edge.similarity !== undefined && edge.similarity < SPRS_PROFILE.similarityFloor) row.leaking += weight;
    out.set(edge.source, row);
    incoming.set(edge.target, (incoming.get(edge.target) ?? new Set()).add(edge.source));
  });
  const pages = rank.scores.map(({ nodeId, score }): SprsPage => {
    const row = out.get(nodeId);
    return {
      nodeId,
      score: Math.round((score / max) * 1000) / 10,
      inDegree: incoming.get(nodeId)?.size ?? 0,
      outDegree: row?.count ?? 0,
      deadEnd: !row,
      underLinked: score < uniform * SPRS_PROFILE.underLinkedShare,
      leak: Boolean(row && row.leaking / row.total >= SPRS_PROFILE.leakShare),
    };
  });
  return { status: 'ready', pages, converged: rank.converged, iterations: rank.iterations, unknownSimilarityEdges: kept.filter((edge) => edge.similarity === undefined).length };
};

export interface WhatIfChange { add?: SprsEdge[]; remove?: Array<{ source: string; target: string }> }

export interface WhatIfRow { nodeId: string; before: number; after: number; delta: number }

const sameEdge = (edge: SprsEdge, ref: { source: string; target: string }) => edge.source === ref.source && edge.target === ref.target;

/** Simulates link changes on a copy; the input arrays are never mutated. */
export const simulateWhatIf = (nodes: PageRankNode[], edges: SprsEdge[], change: WhatIfChange): WhatIfRow[] => {
  const before = computeSprs(nodes, edges);
  const next = edges.filter((edge) => !(change.remove ?? []).some((ref) => sameEdge(edge, ref))).concat(change.add ?? []);
  const after = computeSprs(nodes, next);
  const prior = new Map(before.pages.map((page) => [page.nodeId, page.score]));
  return after.pages
    .map((page) => ({ nodeId: page.nodeId, before: prior.get(page.nodeId) as number, after: page.score, delta: Math.round((page.score - (prior.get(page.nodeId) as number)) * 10) / 10 }))
    .filter((row) => row.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || (a.nodeId < b.nodeId ? -1 : 1));
};
