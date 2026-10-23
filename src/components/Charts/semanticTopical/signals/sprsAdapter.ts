import { computeSprs, type SprsEdge, type SprsReport } from '@/services/semanticGraph/sprs';
import type { SemanticMap } from '@/services/semanticGraph/types';

/**
 * SPRS input from the crawled internal-link graph. Similarity is taken only from an
 * existing lexical topic edge between the same pair; otherwise it stays unknown.
 */
export const buildSprsReport = (graph: SemanticMap): SprsReport => {
  const similarity = new Map<string, number>();
  graph.topicEdges.forEach((e) => {
    similarity.set(`${e.source}|${e.target}`, e.weightedJaccard);
    similarity.set(`${e.target}|${e.source}`, e.weightedJaccard);
  });
  const edges: SprsEdge[] = graph.edges.map((e) => {
    const value = similarity.get(`${e.source}|${e.target}`);
    return { source: e.source, target: e.target, links: e.links, ...(value === undefined ? {} : { similarity: value }) };
  });
  return computeSprs(graph.nodes.map((n) => ({ id: n.id })), edges);
};
