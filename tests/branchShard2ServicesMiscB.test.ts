import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GscPerformanceData, PageAuditData } from '@/types';
import { buildTrafficEvidence } from '@/services/semanticGraph/trafficEvidence';
import { buildTopTenContentGap } from '@/services/targetPhraseAudit/contentGap';

describe('traffic evidence remaining branches', () => {
  const data = (extra: Partial<GscPerformanceData>): GscPerformanceData => ({
    site_url: 'sc-domain:example.com', start_date: '2026-09-01', end_date: '2026-09-30', total_clicks: 0, total_impressions: 0,
    avg_ctr: 0, avg_position: 0, queries: [], pages: [], daily: [], queries_may_be_truncated: false,
    pages_may_be_truncated: false, daily_may_be_truncated: false, max_rows_per_dimension: 25000, ...extra,
  });
  const run = (nodes: unknown[], gscData: GscPerformanceData) => buildTrafficEvidence({
    projectId: 'p', property: 'sc-domain:example.com', startDate: '2026-09-01', endDate: '2026-09-30', nodes: nodes as never, gscData,
  });

  it('marks nodes sharing a URL as ambiguous and flags null rows as invalid', () => {
    const result = run(
      [{ id: 'a', url: 'https://example.com/x' }, { id: 'b', url: 'https://example.com/x' }, { id: 'c', url: 'https://example.com/c' }],
      data({ pages: [null as never, { page: 'https://example.com/x', clicks: 1, impressions: 2, ctr: 0.5, position: 1 }] }),
    );
    expect(result.ambiguousNodeIds).toEqual(['a', 'b']);
    expect(result.invalidRows).toBe(1);
    expect(result.missingNodeIds).toEqual(['c']);
  });

  it('reports ambiguous, truncated and missing nodes depending on truncation', () => {
    const truncated = run([{ id: 'a', url: 'https://example.com/a' }], data({ pages_may_be_truncated: true }));
    expect(truncated.uncertainNodeIds).toEqual(['a']);
    const nodes = [{ id: 'a', url: 'https://example.com/a' }, { id: 'a2', url: 'https://example.com/a' }];
    expect(run(nodes, data({ pages_may_be_truncated: true })).ambiguousNodeIds).toEqual(['a', 'a2']);
    expect(run([{ id: 'z', url: 'https://example.com/z' }], data({})).missingNodeIds).toEqual(['z']);
  });
});

describe('content gap remaining branches', () => {
  it('accepts a target audit identified only by its final URL', () => {
    const audit = (url: string, final: string) => ({ url, final_url: final, http_status: 200, content_stats: { body_text: 'seo guide' }, meta_tags: {}, headings: { h1_texts: [] } }) as unknown as PageAuditData;
    const report = buildTopTenContentGap({
      phrase: 'seo',
      rows: [{ type: 'organic', rank: 1, url: 'https://a.test/' }],
      evidence: [{ url: 'https://a.test/', fetchedAt: '2026-10-01T00:00:00Z', audit: audit('https://a.test/', 'https://a.test/') }],
      targetPageAudit: audit('', 'https://mine.test/'),
    });
    expect(report.targetAvailable).toBe(true);
  });
});

describe('schedule handoff without stored history', () => {
  beforeEach(() => vi.resetModules());

  it('creates the history and marks an enabled failed run as failed', async () => {
    const saved = vi.fn();
    vi.doMock('@/services/schedules/persistence', () => ({
      loadScheduledAudits: () => [{ id: 's1', url: 'https://x.test/', intervalHours: 24, enabled: true, status: 'scheduled', createdAt: '2026-10-01T00:00:00Z', nextRunAt: '2026-10-02T00:00:00Z' }],
      saveScheduledAudits: saved,
    }));
    const { applyScheduledExecution } = await import('@/services/schedules/handoff');
    const next = applyScheduledExecution('project-a', {
      projectId: 'project-a', scheduleId: 's1', taskType: 'page-audit', startedAt: '2026-10-01T09:00:00Z',
      completedAt: '2026-10-01T09:01:00Z', succeeded: false, nextRunAt: '2026-10-02T09:00:00Z', error: 'boom',
    });
    expect(next?.status).toBe('failed');
    expect(next?.runHistory).toEqual([{ startedAt: '2026-10-01T09:00:00Z', completedAt: '2026-10-01T09:01:00Z', succeeded: false, error: 'boom' }]);
    expect(saved).toHaveBeenCalledTimes(1);
    vi.doUnmock('@/services/schedules/persistence');
  });
});
