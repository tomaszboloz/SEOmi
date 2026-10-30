import { applyGate } from '@/services/indexabilityGate';
import { computeSprs, SPRS_PROFILE, type SprsEdge, type SprsReport } from '@/services/semanticGraph/sprs';
import type { SemanticContentEdge, SemanticMap } from '@/services/semanticGraph/types';

/** PDOM link mass (#70/#71): weighted zones count by profile weight, unweighted ones at the neutral weight. */
const zoneWeighting = (edge: SemanticContentEdge): Pick<SprsEdge, 'weight' | 'unweightedZoneLinks'> => {
  if (edge.zoneWeightSum === undefined && edge.unweightedZoneLinks === undefined) return {};
  const unweighted = edge.unweightedZoneLinks ?? 0;
  const weight = (edge.zoneWeightSum ?? 0) + unweighted * SPRS_PROFILE.unweightedZoneWeight;
  return weight > 0 ? { weight, unweightedZoneLinks: unweighted } : { unweightedZoneLinks: unweighted };
};

export const buildSprsInput = (graph: SemanticMap): { nodes: Array<{ id: string }>; edges: SprsEdge[] } => {
  const eligiblePages = new Set(applyGate(graph.nodes.map((node) => node.page)).pages);
  const nodes = graph.nodes.filter((node) => eligiblePages.has(node.page));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const similarity = new Map<string, number>();
  graph.topicEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)).forEach((e) => {
    similarity.set(`${e.source}|${e.target}`, e.weightedJaccard);
    similarity.set(`${e.target}|${e.source}`, e.weightedJaccard);
  });
  // An edge whose every link is nofollow passes no SPRS flow (#71 GEM-71-T02).
  const flowing = (e: SemanticContentEdge) => !e.nofollowLinks || e.nofollowLinks < e.links;
  const edges: SprsEdge[] = graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target) && flowing(e)).map((e) => {
    const value = similarity.get(`${e.source}|${e.target}`);
    const followed = e.links - (e.nofollowLinks ?? 0);
    const context = e.contextKnownLinks && e.contextKnownLinks === followed ? (e.contextSimilaritySum ?? 0) / followed : undefined;
    return { source: e.source, target: e.target, links: e.links, ...zoneWeighting(e), ...(value === undefined ? {} : { similarity: value }), ...(context === undefined ? {} : { contextSimilarity: context }) };
  });
  return { nodes: nodes.map((node) => ({ id: node.id })), edges };
};

export const buildSprsReport = (graph: SemanticMap): SprsReport => {
  const { nodes, edges } = buildSprsInput(graph);
  return computeSprs(nodes, edges);
};
