import { describe, expect, it } from 'vitest';
import { buildTrafficEvidence } from '@/services/semanticGraph/trafficEvidence';

describe('trafficEvidence deep branches', () => {
  it('covers invalid requests, non-array nodes, and duplicate node IDs', () => {
    // null request
    expect(buildTrafficEvidence(null as any).status).toBe('invalid');
    // non-array nodes
    expect(buildTrafficEvidence({ projectId: 'p1', nodes: 'bad' } as any).status).toBe('invalid');
    // duplicate node IDs
    const dupRes = buildTrafficEvidence({
      projectId: 'p1',
      property: 'https://site.test/',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      nodes: [{ id: 'n1' }, { id: 'n1' }],
    } as any);
    expect(dupRes.status).toBe('invalid');
    expect(dupRes.errors).toContain('node ids must be unique and non-empty');
  });

  it('covers GSC data mismatches and invalid page array', () => {
    const baseReq = {
      projectId: 'p1',
      property: 'https://site.test/',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      filters: {},
      nodes: [{ id: 'n1', url: 'https://site.test/p1' }],
    };
    // Mismatched property and date range in gscData
    const mismatch = buildTrafficEvidence({
      ...baseReq,
      gscData: {
        site_url: 'https://other.test/',
        start_date: '2026-02-01',
        end_date: '2026-02-28',
        filters: { country: 'USA' },
        pages: null as any,
      } as any,
    });
    expect(mismatch.status).toBe('invalid');
    expect(mismatch.errors).toContain('GSC property does not match the request');
    expect(mismatch.errors).toContain('GSC date range does not match the request');
    expect(mismatch.errors).toContain('GSC page rows are invalid');
  });

  it('covers out-of-scope, ambiguous, and duplicate row collision handling', () => {
    const res = buildTrafficEvidence({
      projectId: 'p1',
      property: 'https://site.test/',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      filters: {},
      nodes: [
        { id: 'n1', url: 'https://external.test/page' }, // out of scope
        { id: 'n2', url: 'https://site.test/dup' }, // ambiguous share
        { id: 'n3', url: 'https://site.test/dup' }, // ambiguous share
        { id: 'n4', url: 'https://site.test/unique' },
      ],
      gscData: {
        site_url: 'https://site.test/',
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        filters: {},
        pages_may_be_truncated: true,
        pages: [
          { page: 'https://site.test/unique', clicks: 10, impressions: 100, ctr: 0.1, position: 2 },
          { page: 'https://site.test/unique', clicks: 5, impressions: 50, ctr: 0.1, position: 3 }, // duplicate collision -> deleted!
          { page: 'invalid url', clicks: 1, impressions: 1, ctr: 1, position: 1 },
          { page: 'https://other.test/ignore', clicks: 1, impressions: 1, ctr: 1, position: 1 },
        ],
      } as any,
    });
    expect(res.status).toBe('partial');
    expect(res.outOfScopeNodeIds).toContain('n1');
    expect(res.ambiguousNodeIds).toContain('n2');
    expect(res.ambiguousNodeIds).toContain('n3');
    expect(res.uncertainNodeIds).toContain('n4');
    expect(res.invalidRows).toBeGreaterThan(0);
    expect(res.ignoredRows).toBeGreaterThan(0);
  });
});
