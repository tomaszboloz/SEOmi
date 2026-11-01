import { calculatePageRank, type PageRankEdge, type PageRankNode } from './pageRank';
import { applySimilarityWeights } from './sprsSimilarity';

export interface SprsEdge extends PageRankEdge {
  /** Semantic similarity source->target in [0,1]; undefined means unknown (never guessed). */
  similarity?: number;
  /** Lexical simContext of the anchor's ±15-word context vs the target's terms; undefined means unknown. */
  contextSimilarity?: number;
  /** Links on this edge whose DOM zone carried no profile weight (#70). */
  unweightedZoneLinks?: number;
}

export const SPRS_PROFILE = {
  /** Page is under-linked when its score is below this share of the uniform score 1/n. */
  underLinkedShare: 0.5,
  /** Outgoing edge counts as leaking when similarity is known and below this floor; also the W multiplier floor. */
  similarityFloor: 0.05,
  /** Node leaks when at least this share of its outgoing weight is leaking. */
  leakShare: 0.5,
  /** Weight of a link whose zone is unknown or unweighted (`main` without render); counted, never hidden. */
  unweightedZoneWeight: 1,
  /** Upper bound of the convergence tolerance; large graphs use a tighter one (#71). */
  tolerance: 1e-6,
  /** Tolerance never exceeds this share of the uniform score 1/n, so scores stay meaningful on big graphs. */
  toleranceUniformShare: 0.01,
  maxIterations: 150,
} as const;

export interface SprsPage {
  nodeId: string;
  /** 0-100, scaled so the best page is 100. */
  score: number;
  /** Raw stationary probability; all pages sum to ~1. */
  probability: number;
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
  residual: number;
  unknownSimilarityEdges: number;
  /** Links weighted at the neutral zone weight because their zone is unknown or unweighted. */
  unweightedZoneLinks: number;
  /** Self-links removed before ranking (GEM-70-06): they pass no flow, but are reported, not hidden. */
  droppedSelfEdges?: number;
  /** Pages and edges kept out of the ranking with their reason (GEM-70-06); set by `buildSprsReport`. */
  excluded?: { gatedPages: number; nofollowOnlyEdges: number };
  /** Edges whose flow was multiplied by simPage / simContext (known for every edge of their source). */
  pageSimilarityWeightedEdges?: number;
  contextSimilarityWeightedEdges?: number;
}

const EMPTY: SprsReport = { status: 'unavailable', pages: [], converged: true, iterations: 0, residual: 0, unknownSimilarityEdges: 0, unweightedZoneLinks: 0 };

const isSelf = (edge: SprsEdge): boolean => edge.source === edge.target;

/** Similarity outside [0,1] or not finite is treated as unknown, never as a measured leak (#71 GEM-71-03). */
export const knownSimilarity = (edge: SprsEdge): number | undefined =>
  typeof edge.similarity === 'number' && Number.isFinite(edge.similarity) && edge.similarity >= 0 && edge.similarity <= 1 ? edge.similarity : undefined;

/** Self-links are dropped (reason: they pass no authority to other pages). */
const usable = (edges: SprsEdge[]): SprsEdge[] => edges.filter((edge) => !isSelf(edge));

/** min(1e-6, 1% of 1/n): unchanged below 10k pages, scales down above. */
export const sprsTolerance = (nodeCount: number): number =>
  Math.min(SPRS_PROFILE.tolerance, SPRS_PROFILE.toleranceUniformShare / Math.max(nodeCount, 1));

export const computeSprs = (nodes: PageRankNode[], edges: SprsEdge[], initialRank?: ReadonlyMap<string, number>): SprsReport => {
  if (!nodes.length) return EMPTY;
  const kept = usable(edges);
  const similarityWeighting = applySimilarityWeights(kept, SPRS_PROFILE.similarityFloor);
  const rank = calculatePageRank(nodes, similarityWeighting.edges, { tolerance: sprsTolerance(nodes.length), maxIterations: SPRS_PROFILE.maxIterations, initialRank });
  // A reduce, not Math.max(...spread): spreading 100k+ scores overflows the call stack (#71 GEM-71-10).
  const max = rank.scores.reduce((best, row) => Math.max(best, row.score), 0);
  const uniform = 1 / nodes.length;
  const out = new Map<string, { total: number; leaking: number; count: number }>();
  const incoming = new Map<string, Set<string>>();
  kept.forEach((edge) => {
    const weight = edge.weight ?? edge.links ?? 1;
    const row = out.get(edge.source) ?? { total: 0, leaking: 0, count: 0 };
    row.total += weight;
    row.count += 1;
    const similarity = knownSimilarity(edge);
    if (similarity !== undefined && similarity < SPRS_PROFILE.similarityFloor) row.leaking += weight;
    out.set(edge.source, row);
    incoming.set(edge.target, (incoming.get(edge.target) ?? new Set()).add(edge.source));
  });
  const pages = rank.scores.map(({ nodeId, score }): SprsPage => {
    const row = out.get(nodeId);
    return {
      nodeId,
      score: Math.round((score / max) * 1000) / 10,
      probability: score,
      inDegree: incoming.get(nodeId)?.size ?? 0,
      outDegree: row?.count ?? 0,
      deadEnd: !row,
      underLinked: score < uniform * SPRS_PROFILE.underLinkedShare,
      leak: Boolean(row && row.leaking / row.total >= SPRS_PROFILE.leakShare),
    };
  });
  return {
    status: 'ready', pages, converged: rank.converged, iterations: rank.iterations, residual: rank.residual,
    unknownSimilarityEdges: kept.filter((edge) => knownSimilarity(edge) === undefined).length,
    droppedSelfEdges: edges.length - kept.length,
    unweightedZoneLinks: kept.reduce((sum, edge) => sum + (edge.unweightedZoneLinks ?? 0), 0),
    pageSimilarityWeightedEdges: similarityWeighting.pageWeightedEdges,
    contextSimilarityWeightedEdges: similarityWeighting.contextWeightedEdges,
  };
};

export * from './sprsWhatIf';
export * from './sprsFlagChanges';
