import { describe, expect, it } from 'vitest';
import { calculatePageRank } from '@/services/semanticGraph/pageRank';
import { buildContentEdges } from '@/services/semanticGraph/content';
import { computeSprs, simulateWhatIfRun } from '@/services/semanticGraph/sprs';
import { buildSprsInput } from '@/services/sprs/report';
import type { SemanticMap } from '@/services/semanticGraph/types';
import type { CrawledPageSummary } from '@/types';

const nodes = ['a', 'b', 'c'].map((id) => ({ id }));
const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }, { source: 'c', target: 'a' }, { source: 'a', target: 'c' }];

describe('PageRank warm start (#71)', () => {
  it('reports the last residual and reaches the same ranks from a prior vector', () => {
    const cold = calculatePageRank(nodes, edges, { tolerance: 1e-9 });
    expect(cold.residual).toBeLessThanOrEqual(1e-9);
    const prior = new Map(cold.scores.map((row) => [row.nodeId, row.score]));
    const warm = calculatePageRank(nodes, edges, { tolerance: 1e-9, initialRank: prior });
    expect(warm.iterations).toBeLessThan(cold.iterations);
    warm.scores.forEach((row, i) => expect(row.score).toBeCloseTo(cold.scores[i].score, 8));
    expect(calculatePageRank([], [], {}).residual).toBe(0);
  });
  it('falls back to uniform for an all-zero prior and rejects invalid values', () => {
    const zero = calculatePageRank(nodes, edges, { initialRank: new Map([['a', 0], ['b', 0], ['c', 0]]) });
    expect(zero.converged).toBe(true);
    expect(() => calculatePageRank(nodes, edges, { initialRank: new Map([['a', -1]]) })).toThrow(TypeError);
    expect(() => calculatePageRank(nodes, edges, { initialRank: new Map([['a', Number.NaN]]) })).toThrow(TypeError);
  });
});

describe('SPRS link flow (#70/#71)', () => {
  it('exposes raw probabilities that sum to one', () => {
    const report = computeSprs(nodes, edges);
    expect(report.pages.reduce((sum, page) => sum + page.probability, 0)).toBeCloseTo(1, 9);
    expect(report.residual).toBeLessThanOrEqual(1e-6);
    expect(report.unweightedZoneLinks).toBe(0);
  });
  it('warm-starts What-If runs and returns solver state', () => {
    const run = simulateWhatIfRun(nodes, edges, { remove: [{ source: 'a', target: 'c' }] });
    expect(run.converged).toBe(true);
    expect(run.iterations).toBeGreaterThan(0);
    expect(run.rows.length).toBeGreaterThan(0);
  });
  it('weights content edges by DOM zone and counts unweighted links', () => {
    const page = (url: string, links: CrawledPageSummary['links']) => ({ url, final_url: url, links, semantic_links: links }) as unknown as CrawledPageSummary;
    const link = (target: string, zone?: string) => ({ target_url: target, anchor_text: 'x', is_internal: true, ...(zone ? { zone } : {}) });
    const pages = [
      page('https://s.test/a', [link('https://s.test/b', 'nav_breadcrumb'), link('https://s.test/b', 'main'), link('https://s.test/c', 'sidebar_footer')]),
      page('https://s.test/b', [link('https://s.test/a')]),
      page('https://s.test/c', []),
    ];
    const { allEdges } = buildContentEdges(pages, { includeAllInternalLinks: true });
    const ab = allEdges.find((edge) => edge.target === 'page-1');
    expect(ab).toMatchObject({ links: 2, zoneWeightSum: 0.25, unweightedZoneLinks: 1 });
    const graph = { nodes: pages.map((p, i) => ({ id: `page-${i}`, page: p })), edges: allEdges, topicEdges: [] } as unknown as SemanticMap;
    const input = buildSprsInput(graph);
    expect(input.edges.find((edge) => edge.target === 'page-1')).toMatchObject({ weight: 1.25, unweightedZoneLinks: 1 });
    expect(input.edges.find((edge) => edge.target === 'page-2')).toMatchObject({ weight: 0.05, unweightedZoneLinks: 0 });
    expect(computeSprs(input.nodes, input.edges).unweightedZoneLinks).toBe(2);
  });
  it('keeps legacy edges without zone data on link counts', () => {
    const graph = { nodes: [{ id: 'p0', page: { url: 'https://s.test/' } }, { id: 'p1', page: { url: 'https://s.test/x' } }], edges: [{ id: 'e', source: 'p0', target: 'p1', anchors: [], links: 3 }], topicEdges: [] } as unknown as SemanticMap;
    const [edge] = buildSprsInput(graph).edges;
    expect(edge.weight).toBeUndefined();
    expect(edge.links).toBe(3);
  });
});
