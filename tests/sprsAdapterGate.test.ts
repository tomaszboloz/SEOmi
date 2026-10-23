import { describe, expect, it } from 'vitest';
import { buildSprsReport } from '@/components/Charts/semanticTopical/signals/sprsAdapter';
import type { SemanticMap } from '@/services/semanticGraph/types';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, extra: Partial<CrawledPageSummary> = {}) => ({ url, final_url: url, http_status: 200, ...extra }) as unknown as CrawledPageSummary;
const node = (p: CrawledPageSummary) => ({ id: p.url, page: p, clusterId: 'c', clusterLabel: 'c', semanticSignalCount: 0, incomingContentLinks: 0, orphan: false });
const graph = (pages: CrawledPageSummary[], edges: Array<[string, string]>, topic: Array<[string, string, number]> = []) => ({
  nodes: pages.map(node),
  edges: edges.map(([source, target]) => ({ id: `${source}>${target}`, source, target, links: 1 })),
  topicEdges: topic.map(([source, target, weightedJaccard]) => ({ source, target, weightedJaccard })),
}) as unknown as SemanticMap;

const A = 'https://a/', B = 'https://a/b', C = 'https://a/c';

describe('buildSprsReport', () => {
  it('returns an empty report for an empty graph', () => {
    const report = buildSprsReport(graph([], []));
    expect(report.pages).toEqual([]);
    expect(report.status).not.toBe('ready');
  });

  it('drops noindex pages and every edge touching them', () => {
    const report = buildSprsReport(graph([page(A), page(B), page(C, { meta_robots: 'noindex' })], [[A, B], [B, C], [C, A]]));
    expect(report.pages.map((row) => row.nodeId).sort()).toEqual([A, B]);
    const a = report.pages.find((row) => row.nodeId === A)!;
    expect(a.inDegree).toBe(0);
    expect(a.outDegree).toBe(1);
    expect(report.pages.find((row) => row.nodeId === B)!.deadEnd).toBe(true);
  });

  it('flags a leak only when a known similarity is low, in either topic-edge direction', () => {
    const pages = [page(A), page(B)];
    const unknown = buildSprsReport(graph(pages, [[A, B]]));
    expect(unknown.pages.find((row) => row.nodeId === A)!.leak).toBe(false);
    const low = buildSprsReport(graph(pages, [[A, B]], [[B, A, 0]]));
    expect(low.pages.find((row) => row.nodeId === A)!.leak).toBe(true);
    const high = buildSprsReport(graph(pages, [[A, B]], [[A, B, 0.9]]));
    expect(high.pages.find((row) => row.nodeId === A)!.leak).toBe(false);
  });
});
