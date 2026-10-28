import { computeSprs, type SprsEdge } from '@/services/semanticGraph/sprs';
import type { SemanticMap } from '@/services/semanticGraph/types';
import { busUrlKey } from '@/services/recommendationBus/url';
import { buildSprsInput } from '@/services/sprs/report';

export interface SprsGainContext {
  nodes: Array<{ id: string }>;
  edges: SprsEdge[];
  nodeFor: (url: string) => string | undefined;
  before: Map<string, number>;
}

/** Solver baseline for the gate-eligible link graph; null when SPRS cannot run on this crawl. */
export const sprsGainContext = (graph: SemanticMap): SprsGainContext | null => {
  const { nodes, edges } = buildSprsInput(graph);
  const report = computeSprs(nodes, edges);
  if (report.status !== 'ready') return null;
  const ids = new Set(nodes.map((node) => node.id));
  const byUrl = new Map<string, string>();
  graph.nodes.filter((node) => ids.has(node.id)).forEach((node) => [node.page.url, node.page.final_url].forEach((url) => {
    const key = url ? busUrlKey(url) : '';
    if (key && !byUrl.has(key)) byUrl.set(key, node.id);
  }));
  return { nodes, edges, nodeFor: (url) => byUrl.get(busUrlKey(url)), before: new Map(report.pages.map((page) => [page.nodeId, page.score])) };
};

/**
 * Target's SPRS change (0-100 scale) after adding one source->target content link, solved on a copy of the
 * graph. Null when either page is outside the solver graph: unknown, never zero.
 */
export const expectedSprGain = (context: SprsGainContext, sourceUrl: string, targetUrl: string, similarity: number): number | null => {
  const source = context.nodeFor(sourceUrl);
  const target = context.nodeFor(targetUrl);
  const before = target ? context.before.get(target) : undefined;
  if (!source || !target || source === target || before === undefined) return null;
  const after = computeSprs(context.nodes, [...context.edges, { source, target, links: 1, similarity }]);
  const score = after.pages.find((page) => page.nodeId === target)?.score;
  return score === undefined ? null : Math.round((score - before) * 10) / 10;
};
