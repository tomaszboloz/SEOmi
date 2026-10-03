import type { CrawledPageSummary } from '@/types';
import type { SemanticMap } from '@/services/semanticMap';
import type { TopicalMapDocument } from './types';
import { cleanText, MAX_NODES, MAX_TERMS_PER_NODE } from './primitives';
import { createTopicalNode } from './factories';
export const importCrawlClusters = (
  document: TopicalMapDocument,
  map: SemanticMap,
  pages: CrawledPageSummary[],
  runId: string,
): TopicalMapDocument => {
  const existing = new Set(document.nodes.filter((node) => node.sourceRunId === runId).map((node) => node.sourceClusterId));
  const additions = map.clusters.filter((cluster) => !existing.has(cluster.id)).map((cluster) => {
    const members = map.nodes.filter((node) => node.clusterId === cluster.id);
    const memberUrls = new Set(members.flatMap((node) => [node.page.url, node.page.final_url]).filter((url): url is string => Boolean(url)));
    const sourceUrls = pages.filter((page) => memberUrls.has(page.url) || memberUrls.has(page.final_url)).map((page) => page.final_url || page.url);
    const evidenceTerms = [...new Set(members.flatMap((node) => node.page.semantic_terms ?? []).map((term) => cleanText(term, 100).toLocaleLowerCase()).filter(Boolean))].slice(0, MAX_TERMS_PER_NODE);
    return { ...createTopicalNode(cluster.label), kind: 'cluster' as const, evidenceTerms, sourceUrls, sourceRunId: runId, sourceClusterId: cluster.id };
  });
  return { ...document, nodes: [...document.nodes, ...additions].slice(0, MAX_NODES) };
};
