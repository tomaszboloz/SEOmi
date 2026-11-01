// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeSprs } from '@/services/semanticGraph/sprs';
import { buildSprsReport } from '@/services/sprs/report';
import type { SemanticMap, SemanticPageNode } from '@/services/semanticGraph/types';
import type { CrawledPageSummary } from '@/types';

const A = 'https://a.test/', B = 'https://a.test/b', C = 'https://a.test/c';
const node = (url: string, extra: object = {}): SemanticPageNode => ({ id: url, page: { url, final_url: url, http_status: 200, ...extra } as unknown as CrawledPageSummary, clusterId: 'c', clusterLabel: 'c', semanticSignalCount: 0, incomingContentLinks: 0, orphan: false });

describe('SPRS reports why edges and pages were left out (#70 GEM-70-06)', () => {
  it('counts dropped self-links instead of hiding them', () => {
    const report = computeSprs([{ id: A }, { id: B }], [{ source: A, target: A, links: 1 }, { source: A, target: B, links: 1 }]);
    expect(report.droppedSelfEdges).toBe(1);
    expect(computeSprs([{ id: A }], []).droppedSelfEdges).toBe(0);
  });
  it('reports nofollow-only edges and gated pages next to the ranking', () => {
    const graph = {
      nodes: [node(A), node(B), node(C, { meta_robots: 'noindex' })],
      edges: [{ id: '1', source: A, target: B, links: 2, nofollowLinks: 2 }, { id: '2', source: B, target: A, links: 1 }, { id: '3', source: B, target: C, links: 1 }],
      topicEdges: [],
    } as unknown as SemanticMap;
    const report = buildSprsReport(graph);
    expect(report.excluded).toEqual({ gatedPages: 1, nofollowOnlyEdges: 1 });
    expect(report.pages.map((page) => page.nodeId).sort()).toEqual([A, B]);
  });
});
