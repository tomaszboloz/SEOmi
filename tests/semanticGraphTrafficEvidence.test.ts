import { describe, expect, it } from 'vitest';
import type { GscPerformanceData } from '@/types';
import { buildTrafficEvidence } from '@/services/semanticGraph/trafficEvidence';

const baseData = (extra: Partial<GscPerformanceData> = {}): GscPerformanceData => ({
  site_url: 'sc-domain:example.com', start_date: '2026-09-01', end_date: '2026-09-30',
  total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0, queries: [], pages: [], daily: [],
  queries_may_be_truncated: false, pages_may_be_truncated: false, daily_may_be_truncated: false,
  max_rows_per_dimension: 25000, ...extra,
});
const request = (extra: Record<string, unknown> = {}) => ({
  projectId: 'project-1', property: 'sc-domain:example.com', startDate: '2026-09-01', endDate: '2026-09-30',
  nodes: [{ id: 'page-a', page: { url: 'https://example.com/old/', final_url: 'https://example.com/new/' } }, { id: 'page-b', page: { url: 'https://example.com/missing' } }],
  gscData: baseData(), ...extra,
});

describe('semantic graph traffic evidence', () => {
  it('joins a final URL, keeps real zeros and leaves absent rows null', () => {
    const result = buildTrafficEvidence(request({ gscData: baseData({ pages: [
      { page: 'https://example.com/new/', clicks: 0, impressions: 0, ctr: 0, position: 0 },
    ] }) }));
    expect(result.status).toBe('complete');
    expect(result.matchedNodeIds).toEqual(['page-a']);
    expect(result.nodes.find((node) => node.nodeId === 'page-a')).toMatchObject({ observed: true, metrics: { clicks: 0, impressions: 0, ctr: 0, position: 0 } });
    expect(result.nodes.find((node) => node.nodeId === 'page-b')).toMatchObject({ observed: false, metrics: { clicks: null, impressions: null } });
    expect(result.missingNodeIds).toEqual(['page-b']);
  });

  it('marks truncation as partial and never infers zeros for missing pages', () => {
    const result = buildTrafficEvidence(request({ gscData: baseData({ pages_may_be_truncated: true }) }));
    expect(result).toMatchObject({ status: 'partial', truncated: true, uncertainNodeIds: ['page-a', 'page-b'], missingNodeIds: [] });
    expect(result.nodes.every((node) => node.metrics.clicks === null && node.observation === 'truncated')).toBe(true);
  });

  it('reports unavailable GSC data with null metrics', () => {
    const result = buildTrafficEvidence(request({ gscData: null }));
    expect(result.status).toBe('unavailable');
    expect(result.nodes.every((node) => !node.observed && node.metrics.clicks === null)).toBe(true);
  });

  it('guards project, property, dates and filters', () => {
    expect(buildTrafficEvidence(request({ projectId: ' ' })).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ property: 'https://other.example/' })).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ startDate: '2026-10-01' })).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ filters: { device: 'MOBILE' }, gscData: baseData({ filters: { device: 'DESKTOP' } }) })).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ gscData: baseData({ site_url: 'https://other.example/' }) })).status).toBe('invalid');
  });

  it('rejects mismatched source range and malformed filter input', () => {
    expect(buildTrafficEvidence(request({ gscData: baseData({ end_date: '2026-09-29' }) })).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ filters: { country: 'PL' } })).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ filters: { search_type: 'unknown' } })).status).toBe('invalid');
  });

  it('handles out-of-scope, duplicate and malformed rows without synthetic traffic', () => {
    const result = buildTrafficEvidence(request({ gscData: baseData({ pages: [
      { page: 'https://evil.example/page', clicks: 2, impressions: 4, ctr: 0.5, position: 2 },
      { page: 'https://example.com/missing', clicks: -1, impressions: 3, ctr: 0.1, position: 3 },
      { page: 'https://example.com/missing', clicks: 1, impressions: 2, ctr: 0.5, position: 2 },
      { page: 'https://example.com/missing', clicks: 1, impressions: 2, ctr: 0.5, position: 2 },
    ] }) }));
    expect(result.ignoredRows).toBe(1);
    expect(result.invalidRows).toBe(3);
    expect(result.status).toBe('partial');
    expect(result.nodes.find((node) => node.nodeId === 'page-b')?.metrics.clicks).toBe(null);
  });

  it('does not call unavailable observations missing and exposes rejected source rows as partial', () => {
    const unavailable = buildTrafficEvidence(request({ gscData: null }));
    expect(unavailable.missingNodeIds).toEqual([]);
    const partial = buildTrafficEvidence(request({ gscData: baseData({ pages: [{ page: null as never, clicks: 0, impressions: 0, ctr: 0, position: 0 }] }) }));
    expect(partial).toMatchObject({ status: 'partial', invalidRows: 1, missingNodeIds: ['page-a', 'page-b'] });
  });

  it('rejects null requests, non-array nodes, empty property, and non-array pages', () => {
    expect(buildTrafficEvidence(null as never).status).toBe('invalid');
    expect(buildTrafficEvidence({} as never).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ property: '' })).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ nodes: [{ id: '' }] })).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ nodes: [{ id: 123 as never }] })).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ nodes: [{ id: 'dup' }, { id: 'dup' }] })).status).toBe('invalid');
    expect(buildTrafficEvidence(request({ gscData: baseData({ pages: null as never }) })).status).toBe('invalid');
    expect(() => buildTrafficEvidence(request({ nodes: [null as never] }))).not.toThrow();
  });

  it('identifies out-of-scope and ambiguous nodes across multiple entities', () => {
    const multiNodeReq = request({
      nodes: [
        { id: 'page-1', url: 'https://other-domain.com/path' },
        { id: 'page-2', url: 'https://example.com/shared' },
        { id: 'page-3', url: 'https://example.com/shared' },
      ],
      gscData: baseData({ pages: [{ page: 'https://example.com/shared', clicks: 5, impressions: 10, ctr: 0.5, position: 1 }] }),
    });
    const result = buildTrafficEvidence(multiNodeReq);
    expect(result.outOfScopeNodeIds).toEqual(['page-1']);
    expect(result.ambiguousNodeIds).toEqual(['page-2', 'page-3']);
  });

  it('does not restore a row after a duplicate URL has invalidated its evidence', () => {
    const result = buildTrafficEvidence(request({ gscData: baseData({ pages: [
      { page: 'https://example.com/missing', clicks: 1, impressions: 2, ctr: 0.5, position: 2 },
      { page: 'https://example.com/missing', clicks: 2, impressions: 4, ctr: 0.5, position: 2 },
      { page: 'https://example.com/missing', clicks: 3, impressions: 6, ctr: 0.5, position: 2 },
    ] }) }));
    expect(result.nodes.find((node) => node.nodeId === 'page-b')).toMatchObject({ observed: false, observation: 'missing', metrics: { clicks: null } });
    expect(result.invalidRows).toBe(2);
  });
});
