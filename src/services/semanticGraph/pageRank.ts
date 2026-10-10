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
}

export interface PageRankScore { nodeId: string; score: number; }

export interface PageRankResult {
  scores: PageRankScore[];
  iterations: number;
  converged: boolean;
}

const DEFAULTS = { damping: 0.85, tolerance: 1e-12, maxIterations: 200 };
const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const validateOptions = (options: PageRankOptions): Required<PageRankOptions> => {
  const result = { ...DEFAULTS, ...options };
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

const edgeWeight = (edge: PageRankEdge): number => {
  const candidate = edge.weight ?? edge.links ?? 1;
  if (!Number.isFinite(candidate) || candidate <= 0) throw new TypeError('PageRank edge weights must be finite and positive');
  return candidate;
};

export function calculatePageRank(nodes: PageRankNode[], edges: PageRankEdge[], options: PageRankOptions = {}): PageRankResult {
  const config = validateOptions(options);
  const ids = nodeIds(nodes);
  if (!ids.length) return { scores: [], iterations: 0, converged: true };
  const index = new Map(ids.map((id, position) => [id, position]));
  const outgoing = ids.map(() => new Map<number, number>());
  edges.forEach((edge) => {
    const source = index.get(edge?.source);
    const target = index.get(edge?.target);
    if (source === undefined || target === undefined) throw new TypeError('PageRank edge references an unknown node');
    const targetWeights = outgoing[source];
    targetWeights.set(target, (targetWeights.get(target) ?? 0) + edgeWeight(edge));
  });
  let rank = ids.map(() => 1 / ids.length);
  let iterations = 0;
  let converged = false;
  while (iterations < config.maxIterations) {
    const dangling = rank.reduce((sum, value, source) => sum + (outgoing[source].size ? 0 : value), 0);
    const next = ids.map(() => (1 - config.damping) / ids.length + config.damping * dangling / ids.length);
    outgoing.forEach((targets, source) => {
      const total = [...targets.values()].reduce((sum, value) => sum + value, 0);
      targets.forEach((weight, target) => { next[target] += config.damping * rank[source] * weight / total; });
    });
    iterations += 1;
    const delta = next.reduce((max, value, position) => Math.max(max, Math.abs(value - rank[position])), 0);
    rank = next;
    if (delta <= config.tolerance) { converged = true; break; }
  }
  const total = rank.reduce((sum, value) => sum + value, 0) || 1;
  const scores = ids.map((nodeId, position) => ({ nodeId, score: rank[position] / total }));
  scores.sort((left, right) => right.score - left.score || compareIds(left.nodeId, right.nodeId));
  return { scores, iterations, converged };
}

export const computePageRank = calculatePageRank;
