import type { CrawledPageSummary } from '@/types';
import type { SemanticContentEdge, SemanticMapOptions } from './types';
import { normalizeGraphUrl, pageOwnersByUrl } from './urls';

export const MAX_GRAPH_EDGES = 5_000;

export const buildContentEdges = (selectedPages: CrawledPageSummary[], options: SemanticMapOptions) => {
  const pageIdByUrl = pageOwnersByUrl(selectedPages);
  const edgeGroups = new Map<string, SemanticContentEdge>();
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
      if (!target || target === source) continue;
      const id = `${source}->${target}`;
      const edge = edgeGroups.get(id) ?? { id, source, target, anchors: [], links: 0 };
      edge.links += 1;
      const anchor = typeof link.anchor_text === 'string' ? link.anchor_text.trim() : '';
      if (anchor && !edge.anchors.includes(anchor) && edge.anchors.length < 3) edge.anchors.push(anchor);
      edgeGroups.set(id, edge);
    }
  }
  const allEdges = [...edgeGroups.values()];
  const edges = allEdges.slice(0, MAX_GRAPH_EDGES);
  const incoming = new Map<string, number>();
  allEdges.forEach((edge) => incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + edge.links));
  return { allEdges, edges, incoming };
};
