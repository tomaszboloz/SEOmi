import { beforeEach, expect, it } from 'vitest';
import type { GscPerformanceData } from '@/types';
import { dailySeriesOf } from '@/services/gscTracker/dailySeries';
import { readGscSnapshots, saveGscSnapshot } from '@/services/gscTracker/persistence';
import { gscData, memoryGscStorage } from './fixtures/gscTracker';

const row = (date: string, clicks = 1) => ({ date, clicks, impressions: clicks * 10, ctr: 0.1, position: 2 });
const range = { startDate: '2026-07-01', endDate: '2026-07-04' };
const saved = (daily: GscPerformanceData['daily'], capturedAt = '2026-07-29T00:00:00Z') =>
  saveGscSnapshot('p', gscData({ daily }), memoryGscStorage(), capturedAt).snapshot;
beforeEach(() => localStorage.clear());

it('prefers capture recency, not list order or period end, and leaves explicit gaps', () => {
  const older = saved([row('2026-07-01', 10), row('2026-07-02', 20), row('2026-07-04', 40)]);
  const newer = saved([row('2026-07-02', 0)], '2026-07-30T00:00:00Z');
  const snapshots = [older, newer];
  const original = structuredClone(snapshots);
  expect(dailySeriesOf(snapshots, range)).toEqual({ daily: [
    { date: '2026-07-01', clicks: 10, impressions: 100 },
    { date: '2026-07-02', clicks: 0, impressions: 0 },
    { date: '2026-07-04', clicks: 40, impressions: 400 },
  ], missingDates: ['2026-07-03'] });
  expect(dailySeriesOf([...snapshots].reverse(), range)).toEqual(dailySeriesOf(snapshots, range));
  expect(snapshots).toEqual(original);
});

it('compares capture timestamps chronologically even when offsets differ', () => {
  const newer = saved([row('2026-07-01', 2)], '2026-07-29T01:00:00Z');
  const older = saved([row('2026-07-01', 1)], '2026-07-29T02:00:00+02:00');
  expect(dailySeriesOf([older, newer], { startDate: range.startDate, endDate: range.startDate }).daily)
    .toEqual([{ date: '2026-07-01', clicks: 2, impressions: 20 }]);
});

it('treats absent or empty daily history as all dates missing without zero fill', () => {
  const legacy = saved([row('2026-07-01')]);
  delete legacy.daily;
  delete legacy.daily_may_be_truncated;
  for (const snapshots of [[], [legacy], [saved([])], [legacy, saved([])]]) {
    expect(dailySeriesOf(snapshots, range)).toEqual({ daily: [],
      missingDates: ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'] });
  }
});

it('keeps known rows from truncated snapshots and does not erase older observations with empty/legacy captures', () => {
  const observed = saved([row('2026-07-01')]);
  observed.daily_may_be_truncated = true;
  const empty = saved([], '2026-07-30T00:00:00Z');
  const legacy = saved([], '2026-07-31T00:00:00Z');
  delete legacy.daily;
  expect(dailySeriesOf([empty, legacy, observed], range)).toEqual({
    daily: [{ date: '2026-07-01', clicks: 1, impressions: 10 }],
    missingDates: ['2026-07-02', '2026-07-03', '2026-07-04'],
  });
});

it('clips observations to inclusive requested dates and returns ascending dates', () => {
  const snapshot = saved([row('2026-06-30'), row('2026-07-04'), row('2026-07-05'), row('2026-07-01')]);
  expect(dailySeriesOf([snapshot], range).daily.map(item => item.date)).toEqual(['2026-07-01', '2026-07-04']);
  expect(dailySeriesOf([snapshot], { startDate: '2026-07-04', endDate: '2026-07-04' }).missingDates).toEqual([]);
});

it('enumerates inclusive UTC calendar days across leap days and year boundaries', () => {
  expect(dailySeriesOf([saved([row('2024-02-29')])], { startDate: '2024-02-28', endDate: '2024-03-01' }))
    .toEqual({ daily: [{ date: '2024-02-29', clicks: 1, impressions: 10 }], missingDates: ['2024-02-28', '2024-03-01'] });
  expect(dailySeriesOf([], { startDate: '2025-12-31', endDate: '2026-01-01' }).missingDates)
    .toEqual(['2025-12-31', '2026-01-01']);
});

it.each([
  { startDate: '2026-02-30', endDate: '2026-03-01' },
  { startDate: '2026-02-28', endDate: '2026-02-29' },
  { startDate: '2026-7-01', endDate: '2026-07-04' },
  { startDate: '2026-07-04', endDate: '2026-07-01' },
])('rejects invalid calendar ranges: %j', invalid => {
  expect(() => dailySeriesOf([], invalid)).toThrow(RangeError);
});

it('merges overlapping saved project windows without including another project', () => {
  saveGscSnapshot('p', gscData({ daily: [row('2026-07-01'), row('2026-07-02')] }), undefined, '2026-07-29T00:00:00Z');
  saveGscSnapshot('p', gscData({ start_date: '2026-07-02', daily: [row('2026-07-02', 2), row('2026-07-04', 4)] }),
    undefined, '2026-07-30T00:00:00Z');
  saveGscSnapshot('q', gscData({ daily: [row('2026-07-03', 999)] }));
  expect(dailySeriesOf(readGscSnapshots('p'), range)).toEqual({ daily: [
    { date: '2026-07-01', clicks: 1, impressions: 10 },
    { date: '2026-07-02', clicks: 2, impressions: 20 },
    { date: '2026-07-04', clicks: 4, impressions: 40 },
  ], missingDates: ['2026-07-03'] });
});

it('resolves equal capture times deterministically without mutating snapshots', () => {
  const first = saved([row('2026-07-01', 1)]);
  const second = saved([row('2026-07-01', 2)]);
  expect(dailySeriesOf([first, second], range).daily[0].clicks).toBe(1);
});
