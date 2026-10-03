import { expect, it } from 'vitest';
import { compareGscSnapshots, snapshotGscPerformance, findGscStrikingDistanceQueries } from '@/services/gscPerformanceTracker';
import { gscData } from './fixtures/gscTracker';
import type { GscPerformanceSnapshot } from '@/services/gscPerformanceTracker';
import i18n from '@/i18n';
const pair = () => [snapshotGscPerformance(gscData()), snapshotGscPerformance(gscData({
  start_date: '2026-08-01', end_date: '2026-08-28',
}))] as const;
it.each([
  [{ site_url: 'other' }, 'differentProperties'], [{ filters: { device: 'MOBILE' } }, 'differentFilters'],
  [{ id: pair()[0].id }, 'samePeriod'], [{ start_date: '2026-07-28' }, 'overlapping'],
] as Array<[Partial<GscPerformanceSnapshot>, string]>)(
  'rejects incompatible comparison %j', (changes, reason) => {
    const [a, b] = pair();
    expect(compareGscSnapshots(a, { ...b, ...changes })).toEqual({ compatible: false,
      reason: i18n.t(`runtimeErrors.gsc.${reason}`), queryChanges: [], pageChanges: [], uncertainBecauseTruncated: true });
  },
);
it('compares only common rows and preserves zero denominator uncertainty', () => {
  const [a, b] = pair();
  a.queries[0] = { query: 'zero', clicks: 0, impressions: 0, ctr: 0, position: 0 };
  b.queries = [{ query: 'zero', clicks: 2, impressions: 3, ctr: 0, position: 4 },
    { query: 'new', clicks: 10, impressions: 20, ctr: 0, position: 8 }];
  const result = compareGscSnapshots(a, b);
  expect(result.queryChanges).toEqual([{ key: 'zero', clicksDelta: 2, clicksDeltaPercent: null,
    impressionsDelta: 3, impressionsDeltaPercent: null, potentialDecline: false,
    baseline: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    current: { clicks: 2, impressions: 3, ctr: 0, position: 4 } }]);
  expect(result.pageChanges).toHaveLength(1);
  expect(result.uncertainBecauseTruncated).toBe(false);
});
it.each([
  [100, 100, 80, 100, true], [100, 100, 100, 80, true],
  [0, 100, 0, 70, true], [100, 99, 0, 0, false], [100, 100, 81, 81, false],
])('classifies decline from %s/%s to %s/%s', (clicks, impressions, nextClicks, nextImpressions, decline) => {
  const [a, b] = pair(); Object.assign(a.queries[0], { clicks, impressions });
  Object.assign(b.queries[0], { clicks: nextClicks, impressions: nextImpressions });
  expect(compareGscSnapshots(a, b).queryChanges[0].potentialDecline).toBe(decline);
});
it.each(['baselineQueries', 'baselinePages', 'currentQueries', 'currentPages'])('preserves truncation uncertainty %s', flag => {
  const [a, b] = pair();
  if (flag === 'baselineQueries') a.queries_may_be_truncated = true;
  if (flag === 'baselinePages') a.pages_may_be_truncated = true;
  if (flag === 'currentQueries') b.queries_may_be_truncated = true;
  if (flag === 'currentPages') b.pages_may_be_truncated = true;
  expect(compareGscSnapshots(a, b).uncertainBecauseTruncated).toBe(true);
});
it('sorts changes by click loss, impression loss then key without reordering source', () => {
  const [a, b] = pair();
  const rows = ['z', 'a', 'impressions', 'clicks'].map(query => ({ query, clicks: 100, impressions: 1000, ctr: 0.1, position: 8 }));
  a.queries = rows; b.queries = rows.map(row => ({ ...row,
    clicks: row.query === 'clicks' ? 0 : 50, impressions: row.query === 'impressions' ? 0 : 1000 }));
  expect(compareGscSnapshots(a, b).queryChanges.map(row => row.key)).toEqual(['clicks', 'impressions', 'a', 'z']);
  expect(a.queries.map(row => row.query)).toEqual(['z', 'a', 'impressions', 'clicks']);
});
it('finds bounded striking distance and sorts ties by position then query', () => {
  const snapshot = pair()[0];
  snapshot.queries = [
    ['low', 3, 500], ['high', 21, 500], ['few', 4, 99],
    ['z', 4, 100], ['a', 4, 100], ['far', 20, 100], ['popular', 10, 101],
  ].map(([query, position, impressions]) => ({ query: String(query), position: Number(position),
    impressions: Number(impressions), clicks: 0, ctr: 0 }));
  expect(findGscStrikingDistanceQueries(snapshot).map(row => row.query)).toEqual(['popular', 'a', 'z', 'far']);
  expect(findGscStrikingDistanceQueries(snapshot, 101).map(row => row.query)).toEqual(['popular']);
  expect(snapshot.queries[0].query).toBe('low');
});
