import type { PageRankEdge } from './pageRank';

export interface SimilarityEdge extends PageRankEdge {
  similarity?: number;
  contextSimilarity?: number;
}

export interface SimilarityWeighting<T extends SimilarityEdge> {
  edges: T[];
  /** Edges whose weight was multiplied by max(floor, simPage). */
  pageWeightedEdges: number;
  /** Edges whose weight was multiplied by max(floor, simContext). */
  contextWeightedEdges: number;
}

const known = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;

/**
 * W = PDOM · max(floor, simPage) · max(floor, simContext) (#71 GEM-71-02).
 *
 * Decision (default chosen by agent, GEM-71-D01): the .05 floor from the Gemini reference code is kept,
 * so a measured low similarity weakens a real hyperlink but never deletes it. A factor is applied to a
 * source page only when it is known for every one of its outgoing edges: PageRank normalises each row,
 * so multiplying only the measured edges would silently favour the unmeasured ones. Otherwise the
 * factor is left out for that row and the edges stay counted as unknown.
 */
export const applySimilarityWeights = <T extends SimilarityEdge>(edges: T[], floor: number): SimilarityWeighting<T> => {
  const bySource = new Map<string, T[]>();
  edges.forEach((edge) => bySource.set(edge.source, [...(bySource.get(edge.source) ?? []), edge]));
  const pageRows = new Set<string>();
  const contextRows = new Set<string>();
  bySource.forEach((row, source) => {
    if (row.every((edge) => known(edge.similarity) !== undefined)) pageRows.add(source);
    if (row.every((edge) => known(edge.contextSimilarity) !== undefined)) contextRows.add(source);
  });
  let pageWeightedEdges = 0;
  let contextWeightedEdges = 0;
  const weighted = edges.map((edge) => {
    const page = pageRows.has(edge.source) ? Math.max(floor, known(edge.similarity) as number) : 1;
    const context = contextRows.has(edge.source) ? Math.max(floor, known(edge.contextSimilarity) as number) : 1;
    if (pageRows.has(edge.source)) pageWeightedEdges += 1;
    if (contextRows.has(edge.source)) contextWeightedEdges += 1;
    if (page === 1 && context === 1) return edge;
    return { ...edge, weight: (edge.weight ?? edge.links ?? 1) * page * context };
  });
  return { edges: weighted, pageWeightedEdges, contextWeightedEdges };
};
