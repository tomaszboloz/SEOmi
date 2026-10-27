import { describe, expect, it } from 'vitest';
import { normalizeGraphUrl, pageOwnersByUrl } from '@/services/semanticGraph/urls';
import { buildContentEdges } from '@/services/semanticGraph/content';
import { buildSemanticTopics } from '@/services/semanticGraph/topics';
import { clusterByAverageLinkage } from '@/services/semanticGraph/clustering';
import { calculatePageRank } from '@/services/semanticGraph/pageRank';
import { computeSprs, simulateWhatIf } from '@/services/semanticGraph/sprs';
import { buildTrafficEvidence } from '@/services/semanticGraph/trafficEvidence';
import { normalizeTrafficDateRange, normalizeTrafficFilters, normalizeTrafficMetric, normalizeTrafficProperty, normalizeTrafficUrl, trafficPropertyMatchesUrl } from '@/services/semanticGraph/trafficEvidenceNormalization';
import { mergeGscPageRows } from '@/services/semanticGraph/trafficMerge';
import { linkZoneWeight } from '@/services/sprs/zoneWeights';
import type { CrawledPageSummary, GscPerformanceData } from '@/types';

const page = (url: string, terms?: string[]) => ({ url, final_url: url, semantic_terms: terms, links: [], http_status: 200 } as unknown as CrawledPageSummary);
const data = (patch: Partial<GscPerformanceData> = {}): GscPerformanceData => ({ site_url: 'https://example.test/', start_date: '2026-10-01', end_date: '2026-10-31', total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0, queries: [], pages: [], daily: [], queries_may_be_truncated: false, pages_may_be_truncated: false, daily_may_be_truncated: false, max_rows_per_dimension: 10, ...patch });

describe('coverage100 semantic graph and SPRS edges', () => {
  it('normalizes graph identities and rejects ambiguous aliases', () => {
    expect(normalizeGraphUrl('/a///#x', 'https://SITE.test/base')).toBe('https://site.test/a');
    expect(normalizeGraphUrl('bad///#x')).toBe('bad');
    expect(pageOwnersByUrl([page('https://site.test/a'), page('https://site.test/a/')])).toEqual(new Map());
  });

  it('builds content edges from semantic or all internal links with bounded anchors', () => {
    const source = { ...page('https://site.test/source'), semantic_links: Array.from({ length: 5 }, (_, i) => ({ target_url: '/target', anchor_text: `A${i}`, is_internal: true })), links: [{ target_url: '/other', anchor_text: 'all', is_internal: true }] } as unknown as CrawledPageSummary;
    const semantic = buildContentEdges([source, page('https://site.test/target'), page('https://site.test/other')], {});
    expect(semantic.edges[0]).toMatchObject({ links: 5, anchors: ['A0', 'A1', 'A2'] });
    expect(buildContentEdges([source, page('https://site.test/target'), page('https://site.test/other')], { includeAllInternalLinks: true }).allEdges).toHaveLength(1);
  });

  it('keeps average linkage deterministic and labels term-free clusters safely', () => {
    expect(clusterByAverageLinkage(0, [])).toEqual([]);
    expect(clusterByAverageLinkage(3, [{ left: 0, right: 1, similarity: 0.5 }, { left: 1, right: 2, similarity: 0.5 }], 0.4)).toEqual([0, 0, 2]);
    const graph = buildSemanticTopics([page('https://site.test/a'), page('https://site.test/b')]);
    expect(graph.groupDetails.get(0)?.label).toBeTruthy();
    expect(graph.topicEdges).toEqual([]);
  });

  it('validates PageRank inputs and preserves sparse graph scores', () => {
    expect(calculatePageRank([], [])).toMatchObject({ scores: [], converged: true });
    expect(calculatePageRank([{ id: 'a' }], []).scores[0].score).toBe(1);
    expect(() => calculatePageRank([{ id: 'a' }], [{ source: 'a', target: 'a', weight: -1 }])).toThrow(/weights/);
    expect(() => calculatePageRank([{ id: 'a' }], [], { damping: Number.NaN })).toThrow(/damping/);
    expect(() => calculatePageRank([{ id: 'a' }], [], { tolerance: -1 })).toThrow(/tolerance/);
  });

  it('computes SPRS what-if changes without mutating links', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [{ source: 'a', target: 'b', similarity: 0 }, { source: 'b', target: 'c' }];
    expect(computeSprs([], []).status).toBe('unavailable');
    expect(computeSprs(nodes, edges).pages.find((row) => row.nodeId === 'a')?.leak).toBe(true);
    const before = JSON.stringify(edges);
    expect(simulateWhatIf(nodes, edges, { add: [{ source: 'c', target: 'a' }] }).length).toBeGreaterThan(0);
    expect(JSON.stringify(edges)).toBe(before);
  });

  it('normalizes traffic scopes, dates, filters and metrics explicitly', () => {
    expect(normalizeTrafficUrl('HTTPS://EXAMPLE.test/a///#x')).toBe('https://example.test/a');
    expect(normalizeTrafficUrl('mailto:x')).toBe('');
    expect(normalizeTrafficProperty('sc-domain:Example.test')).toMatchObject({ kind: 'domain', host: 'example.test' });
    expect(normalizeTrafficProperty('https://example.test/blog')).toMatchObject({ kind: 'prefix', prefix: '/blog' });
    expect(normalizeTrafficProperty('https://example.test/?q=1')).toBeNull();
    const scope = normalizeTrafficProperty('https://example.test/blog')!;
    expect(trafficPropertyMatchesUrl(scope, 'https://example.test/blog/post')).toBe(true);
    expect(trafficPropertyMatchesUrl(scope, 'https://example.test/other')).toBe(false);
    expect(normalizeTrafficDateRange('2026-02-01', '2026-01-01')).toBeNull();
    expect(normalizeTrafficFilters({ device: 'mobile', country: ' POL ' })).toEqual({ device: 'MOBILE', country: 'pol' });
    expect(normalizeTrafficFilters([])).toBeNull();
    expect(normalizeTrafficMetric(-1)).toBeNull();
  });

  it('joins valid GSC rows and reports invalid requests honestly', () => {
    const request = { projectId: 'p', property: 'https://example.test/', startDate: '2026-10-01', endDate: '2026-10-31', filters: {}, nodes: [{ id: 'n', url: 'https://example.test/a' }], gscData: data({ pages: [{ page: 'https://example.test/a', clicks: 2, impressions: 4, ctr: 0.5, position: 2 }] }) };
    expect(buildTrafficEvidence(request).nodes[0]).toMatchObject({ observation: 'gsc', metrics: { clicks: 2 } });
    expect(buildTrafficEvidence({ ...request, gscData: null as never }).status).toBe('unavailable');
    expect(buildTrafficEvidence({ ...request, gscData: data({ site_url: 'https://mismatch.test/' }) }).status).toBe('invalid');
    expect(buildTrafficEvidence({ ...request, gscData: data({ start_date: '2025-01-01', end_date: '2025-01-02' }) }).status).toBe('invalid');
    expect(buildTrafficEvidence({ ...request, nodes: [{ id: 'n' }, { id: 'n' }] }).status).toBe('invalid');
    expect(buildTrafficEvidence(null as never).errors).toEqual(['nodes are required']);
    expect(mergeGscPageRows({ clicks: 0, impressions: 0, ctr: 0, position: 2 }, { clicks: 0, impressions: 0, ctr: 0, position: 4 }).position).toBe(3);

    const partial = buildTrafficEvidence({
      ...request,
      nodes: [{ id: 'in', url: 'https://example.test/in' }, { id: 'out', url: 'https://other.test/out' }],
      gscData: data({
        pages_may_be_truncated: true,
        pages: [
          { page: 'invalid url', clicks: 1 },
          { page: 'https://example.test/ignored-path-outside-scope', clicks: 1 },
          { page: 'https://example.test/in', clicks: -5 },
        ],
      }),
    });
    expect(partial.status).toBe('partial');
    expect(partial.nodes.find((n) => n.nodeId === 'out')?.observation).toBe('out-of-scope');
  });

  it('keeps link zones without evidence unweighted', () => {
    expect(linkZoneWeight({ zone: 'main' })).toEqual({ zone: 'main', weight: null });
    expect(linkZoneWeight({ zone: 'unknown' }, { unknown: 0.2 })).toEqual({ zone: 'unknown', weight: 0.2 });
  });
});
