import type { CrawledPageSummary } from '@/types';
import { linkZoneWeight } from '@/services/sprs/zoneWeights';
import type { SemanticContentEdge, SemanticMapOptions } from './types';
import { normalizeGraphUrl, pageOwnersByUrl } from './urls';
import { linkContextSimilarity, targetTerms } from './contextSimilarity';

export const MAX_GRAPH_EDGES = 5_000;

export const buildContentEdges = (selectedPages: CrawledPageSummary[], options: SemanticMapOptions) => {
  const pageIdByUrl = pageOwnersByUrl(selectedPages);
  const edgeGroups = new Map<string, SemanticContentEdge>();
  const terms = new Map<string, Set<string> | null>();
  const skipped = { selfLinks: 0, unresolvedTargets: 0 };
  const termsOf = (target: string) => {
    if (!terms.has(target)) terms.set(target, targetTerms(selectedPages[Number(target.slice(5))]));
    return terms.get(target) ?? null;
  };
  for (let index = 0; index < selectedPages.length; index += 1) {
    const source = `page-${index}`;
    const pageLinks = options.includeAllInternalLinks
      ? (selectedPages[index].links ?? [])
      : selectedPages[index].semantic_links ?? [];
    for (const link of pageLinks) {
      if (!link.is_internal) continue;
      const target = pageIdByUrl.get(normalizeGraphUrl(
        link.target_url,
        selectedPages[index].final_url || selectedPages[index].url,
      ));
      if (!target) { skipped.unresolvedTargets += 1; continue; }
      if (target === source) { skipped.selfLinks += 1; continue; }
      const id = `${source}->${target}`;
      const edge = edgeGroups.get(id) ?? { id, source, target, anchors: [], links: 0, zoneWeightSum: 0, unweightedZoneLinks: 0 };
      edge.links += 1;
      const { weight } = linkZoneWeight(link);
      if (/(^|\s)nofollow(\s|$)/iu.test(link.rel ?? '')) edge.nofollowLinks = (edge.nofollowLinks ?? 0) + 1;
      else if (weight === null) edge.unweightedZoneLinks = (edge.unweightedZoneLinks ?? 0) + 1;
      else edge.zoneWeightSum = (edge.zoneWeightSum ?? 0) + weight;
      const contextSimilarity = /(^|\s)nofollow(\s|$)/iu.test(link.rel ?? '') ? undefined : linkContextSimilarity(link, termsOf(target));
      if (contextSimilarity !== undefined) {
        edge.contextSimilaritySum = (edge.contextSimilaritySum ?? 0) + contextSimilarity;
        edge.contextKnownLinks = (edge.contextKnownLinks ?? 0) + 1;
      }
      const anchor = typeof link.anchor_text === 'string' ? link.anchor_text.trim() : '';
      if (anchor && !edge.anchors.includes(anchor) && edge.anchors.length < 3) edge.anchors.push(anchor);
      edgeGroups.set(id, edge);
    }
  }
  const allEdges = [...edgeGroups.values()];
  const edges = allEdges.slice(0, MAX_GRAPH_EDGES);
  const incoming = new Map<string, number>();
  allEdges.forEach((edge) => incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + edge.links));
  return { allEdges, edges, incoming, skipped };
};
