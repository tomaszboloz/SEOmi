import type { CrawledPageSummary } from '@/types';
import type { SemanticMap, SemanticMapOptions } from './semanticGraph/types';
import { normalizeGraphUrl } from './semanticGraph/urls';
import { buildSemanticTopics, MAX_TOPIC_EDGES } from './semanticGraph/topics';
import { buildContentEdges, MAX_GRAPH_EDGES } from './semanticGraph/content';

export type {
  SemanticPageNode, SemanticContentEdge, SemanticTopicEdge, SemanticMap, SemanticMapOptions,
} from './semanticGraph/types';

const MAX_GRAPH_NODES = 500;

/** Content-only links and bounded lexical similarity remain separate evidence. */
export const buildSemanticMap = (
  pages: CrawledPageSummary[], startUrl: string, options: SemanticMapOptions = {},
): SemanticMap => {
  const selectedPages = pages.slice(0, MAX_GRAPH_NODES);
  const { termsByPage, topicEdges, totalTopicEdges, groupMembers, groupDetails, find } = buildSemanticTopics(selectedPages);
  const { allEdges, edges, incoming } = buildContentEdges(selectedPages, options);
  const nodes = selectedPages.map((page, index) => {
    const details = groupDetails.get(find(index))!;
    const id = `page-${index}`;
    const incomingContentLinks = incoming.get(id) ?? 0;
    return {
      id,
      page,
      clusterId: details.id,
      clusterLabel: details.label,
      semanticSignalCount: termsByPage[index].length,
      incomingContentLinks,
      orphan: normalizeGraphUrl(page.url) !== normalizeGraphUrl(startUrl)
        && normalizeGraphUrl(page.final_url) !== normalizeGraphUrl(startUrl)
        && incomingContentLinks === 0,
    };
  });
  const clusters = [...groupMembers.entries()]
    .map(([root, members]) => ({ id: groupDetails.get(root)!.id, label: groupDetails.get(root)!.label, pageCount: members.length }))
    .sort((a, b) => b.pageCount - a.pageCount || a.label.localeCompare(b.label));

  return {
    nodes,
    edges,
    topicEdges,
    clusters,
    hasSemanticTerms: termsByPage.some((terms) => terms.length > 0),
    totalEdges: allEdges.length,
    totalTopicEdges,
    totalInternalLinks: allEdges.reduce((sum, edge) => sum + edge.links, 0),
    truncated: pages.length > MAX_GRAPH_NODES || allEdges.length > MAX_GRAPH_EDGES || totalTopicEdges > MAX_TOPIC_EDGES,
  };
};
