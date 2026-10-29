export interface PageRankNode { id: string; }

export interface PageRankEdge {
  source: string;
  target: string;
  /** Existing semantic content edges expose their multiplicity as `links`. */
  links?: number;
  weight?: number;
}

export interface PageRankOptions {
  damping?: number;
  tolerance?: number;
  maxIterations?: number;
  /** Warm start: prior probabilities by node id. Unknown ids start at 1/n; the vector is renormalised. */
  initialRank?: ReadonlyMap<string, number>;
}

export interface PageRankScore { nodeId: string; score: number; }

export interface PageRankResult {
  scores: PageRankScore[];
  iterations: number;
  converged: boolean;
  /** Max absolute change in the last iteration (0 for an empty graph). */
  residual: number;
}

const DEFAULTS = { damping: 0.85, tolerance: 1e-12, maxIterations: 200 };
const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const validateOptions = (options: PageRankOptions): Required<Omit<PageRankOptions, 'initialRank'>> => {
  const { initialRank: _ignored, ...rest } = options;
  const result = { ...DEFAULTS, ...rest };
  if (!Number.isFinite(result.damping) || result.damping < 0 || result.damping >= 1) throw new TypeError('damping must be in [0, 1)');
  if (!Number.isFinite(result.tolerance) || result.tolerance <= 0) throw new TypeError('tolerance must be positive');
  if (!Number.isInteger(result.maxIterations) || result.maxIterations < 1) throw new TypeError('maxIterations must be a positive integer');
  return result;
};

const nodeIds = (nodes: PageRankNode[]): string[] => {
  const ids = nodes.map((node) => node?.id);
  if (ids.some((id) => typeof id !== 'string' || !id.trim())) throw new TypeError('every PageRank node needs a non-empty id');
  if (new Set(ids).size !== ids.length) throw new TypeError('PageRank node ids must be unique');
  return [...ids].sort(compareIds);
};

const startVector = (ids: string[], prior?: ReadonlyMap<string, number>): number[] => {
  const uniform = 1 / ids.length;
  if (!prior) return ids.map(() => uniform);
  const start = ids.map((id) => prior.get(id) ?? uniform);
  if (start.some((value) => !Number.isFinite(value) || value < 0)) throw new TypeError('initialRank values must be finite and non-negative');
  const total = start.reduce((sum, value) => sum + value, 0);
  return total > 0 ? start.map((value) => value / total) : ids.map(() => uniform);
};

const edgeWeight = (edge: PageRankEdge): number => {
  const candidate = edge.weight ?? edge.links ?? 1;
  if (!Number.isFinite(candidate) || candidate <= 0) throw new TypeError('PageRank edge weights must be finite and positive');
  return candidate;
};

export function calculatePageRank(nodes: PageRankNode[], edges: PageRankEdge[], options: PageRankOptions = {}): PageRankResult {
  const config = validateOptions(options);
  const ids = nodeIds(nodes);
  if (!ids.length) return { scores: [], iterations: 0, converged: true, residual: 0 };
  const index = new Map(ids.map((id, position) => [id, position]));
  const outgoing = ids.map(() => new Map<number, number>());
  edges.forEach((edge) => {
    const source = index.get(edge?.source);
    const target = index.get(edge?.target);
    if (source === undefined || target === undefined) throw new TypeError('PageRank edge references an unknown node');
    const targetWeights = outgoing[source];
    targetWeights.set(target, (targetWeights.get(target) ?? 0) + edgeWeight(edge));
  });
  let rank = startVector(ids, options.initialRank);
  let iterations = 0;
  let converged = false;
  let residual = Number.POSITIVE_INFINITY;
  while (iterations < config.maxIterations) {
    const dangling = rank.reduce((sum, value, source) => sum + (outgoing[source].size ? 0 : value), 0);
    const next = ids.map(() => (1 - config.damping) / ids.length + config.damping * dangling / ids.length);
    outgoing.forEach((targets, source) => {
      const total = [...targets.values()].reduce((sum, value) => sum + value, 0);
      targets.forEach((weight, target) => { next[target] += config.damping * rank[source] * weight / total; });
    });
    iterations += 1;
    residual = next.reduce((max, value, position) => Math.max(max, Math.abs(value - rank[position])), 0);
    rank = next;
    if (residual <= config.tolerance) { converged = true; break; }
  }
  const total = rank.reduce((sum, value) => sum + value, 0) || 1;
  const scores = ids.map((nodeId, position) => ({ nodeId, score: rank[position] / total }));
  scores.sort((left, right) => right.score - left.score || compareIds(left.nodeId, right.nodeId));
  return { scores, iterations, converged, residual };
}

export const computePageRank = calculatePageRank;
