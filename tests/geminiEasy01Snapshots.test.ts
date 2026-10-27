import { describe, expect, it } from 'vitest';
import { snapshotGscPerformance } from '@/services/gscTracker/snapshot';
import { gscSnapshotSchema } from '@/services/gscTracker/schema';
import type { GscPerformanceData } from '@/types';

const fixtureData = (overrides: Partial<GscPerformanceData> = {}): GscPerformanceData => ({
  site_url: 'sc-domain:example.com',
  start_date: '2026-08-01',
  end_date: '2026-08-28',
  total_clicks: 10,
  total_impressions: 200,
  avg_ctr: 5.0,
  avg_position: 12.0,
  queries: [{ query: 'example', clicks: 10, impressions: 200, ctr: 5.0, position: 12.0 }],
  pages: [{ page: 'https://example.com/', clicks: 10, impressions: 200, ctr: 5.0, position: 12.0 }],
  daily: [{ date: '2026-08-01', clicks: 10, impressions: 200, ctr: 5.0, position: 12.0 }],
  queries_may_be_truncated: false,
  pages_may_be_truncated: false,
  daily_may_be_truncated: false,
  max_rows_per_dimension: 25000,
  ...overrides,
});

describe('GSC snapshot validation with absent vs observed-zero dates', () => {
  it('faithfully preserves observed-zero daily metrics without discarding rows or values', () => {
    const data = fixtureData({
      daily: [
        { date: '2026-08-01', clicks: 0, impressions: 0, ctr: 0, position: 0 },
        { date: '2026-08-02', clicks: 10, impressions: 200, ctr: 5.0, position: 12.0 },
      ],
    });
    const snapshot = snapshotGscPerformance(data, '2026-08-29T10:00:00Z');
    const parsed = gscSnapshotSchema.parse(snapshot);
    expect(parsed.daily).toBeDefined();
    expect(parsed.daily).toHaveLength(2);
    expect(parsed.daily?.[0]).toEqual({
      date: '2026-08-01',
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    });
  });

  it('keeps absent dates omitted rather than fabricating synthetic rows in sparse daily history', () => {
    const data = fixtureData({
      daily: [
        { date: '2026-08-01', clicks: 0, impressions: 0, ctr: 0, position: 0 },
        { date: '2026-08-05', clicks: 10, impressions: 200, ctr: 5.0, position: 12.0 },
      ],
    });
    const snapshot = snapshotGscPerformance(data);
    const parsed = gscSnapshotSchema.parse(snapshot);
    const observedDates = parsed.daily?.map((row) => row.date);
    expect(observedDates).toEqual(['2026-08-01', '2026-08-05']);
    expect(observedDates).not.toContain('2026-08-02');
    expect(observedDates).not.toContain('2026-08-03');
    expect(observedDates).not.toContain('2026-08-04');
  });

  it('validates snapshots where the daily breakdown is entirely absent', () => {
    const raw = fixtureData();
    const { daily: _omitted, ...dataWithoutDaily } = raw;
    const snapshot = snapshotGscPerformance(dataWithoutDaily as GscPerformanceData);
    expect(snapshot.daily).toBeUndefined();
    expect(snapshot.daily_may_be_truncated).toBeUndefined();
    const result = gscSnapshotSchema.safeParse(snapshot);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.daily).toBeUndefined();
  });

  it('sorts out-of-order daily rows chronologically when parsed through schema', () => {
    const base = snapshotGscPerformance(fixtureData());
    const unsortedDaily = [
      { date: '2026-08-20', clicks: 2, impressions: 50, ctr: 4.0, position: 15.0 },
      { date: '2026-08-05', clicks: 0, impressions: 0, ctr: 0, position: 0 },
      { date: '2026-08-12', clicks: 8, impressions: 150, ctr: 5.33, position: 11.0 },
    ];
    const parsed = gscSnapshotSchema.parse({ ...base, daily: unsortedDaily });
    expect(parsed.daily?.map((row) => row.date)).toEqual(['2026-08-05', '2026-08-12', '2026-08-20']);
  });

  it('rejects snapshots with negative, non-finite, or invalid daily date metrics', () => {
    const valid = snapshotGscPerformance(fixtureData());
    expect(gscSnapshotSchema.safeParse({
      ...valid,
      daily: [{ date: '2026-08-01', clicks: -1, impressions: 10, ctr: 0, position: 1 }],
    }).success).toBe(false);

    expect(gscSnapshotSchema.safeParse({
      ...valid,
      daily: [{ date: '2026-08-01', clicks: 5, impressions: 10, ctr: 0, position: -0.5 }],
    }).success).toBe(false);

    expect(gscSnapshotSchema.safeParse({
      ...valid,
      daily: [{ date: '2026-08-01', clicks: Infinity, impressions: 10, ctr: 0, position: 1 }],
    }).success).toBe(false);

    expect(gscSnapshotSchema.safeParse({
      ...valid,
      daily: [{ date: '2026-99-99', clicks: 0, impressions: 0, ctr: 0, position: 0 }],
    }).success).toBe(false);
  });
});
