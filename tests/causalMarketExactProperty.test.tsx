import { describe, expect, it } from 'vitest';
import { buildCausalImpact } from '@/services/causalMarket/adapter';
import { snapshotGscPerformance } from '@/services/gscTracker/snapshot';
import type { GscPerformanceData } from '@/types';

const dates = Array.from({ length: 28 }, (_, index) => `2026-03-${String(index + 1).padStart(2, '0')}`);
const intervention = { id: 'i1', projectId: 'p1', url: 'site' as const, date: '2026-03-15', kind: 'content' as const, note: '', createdAt: '2026-03-01T00:00:00.000Z' };
const evidence = { status: 'available' as const, source: 'test-market', observations: dates.map((date) => ({ date, level: 100 })) };
const data = (site_url: string, clicks: (index: number) => number): GscPerformanceData => {
  const daily = dates.map((date, index) => ({ date, clicks: clicks(index), impressions: 100, ctr: 0.1, position: 2 }));
  return { site_url, start_date: dates[0], end_date: dates.at(-1)!, total_clicks: daily.reduce((sum, row) => sum + row.clicks, 0), total_impressions: 2800, avg_ctr: 0.1, avg_position: 2, queries: [], pages: [], daily, daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 1000 };
};

describe('causal market exact selected property', () => {
  it('rejects broader properties and accepts the normalized selected URL-prefix property', () => {
    const snapshots = [
      snapshotGscPerformance(data('https://example.com/', (i) => i < 14 ? 50 : 70)),
      snapshotGscPerformance(data('sc-domain:example.com', () => 55)),
      snapshotGscPerformance(data('https://example.com/blog/', (i) => i < 14 ? 50 : 70)),
      snapshotGscPerformance(data('https://control.test/', () => 100)),
    ];
    const input = { interventions: [intervention], market: evidence, updateWindows: [], testSiteUrl: 'https://example.com/blog/' };
    expect(buildCausalImpact({ ...input, snapshots: [snapshots[0], snapshots[3]], testSiteUrl: undefined, exactProperty: true })).toBeNull();
    expect(buildCausalImpact({ ...input, snapshots: snapshots.slice(0, 2).concat(snapshots[3]), exactProperty: true })).toBeNull();
    expect(buildCausalImpact({ ...input, snapshots, testSiteUrl: 'https://example.com/blog', exactProperty: true })).toBeNull();
    expect(buildCausalImpact({ ...input, snapshots, exactProperty: true })?.verdict).toBe('positive');
  });
});
