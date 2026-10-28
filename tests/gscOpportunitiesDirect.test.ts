import { expect, it } from 'vitest';
import { findNearTopTenQueries, findCtrOutliers } from '@/services/gscTracker/opportunities';
import { snapshotGscPerformance } from '@/services/gscPerformanceTracker';
import { gscData } from './fixtures/gscTracker';
const row = (query: string, position: number, clicks = 10, impressions = 100) => ({ query, position, clicks, impressions, ctr: clicks / impressions * 100 });
type OracleRow = ReturnType<typeof row>;
const validForOracle = (item: OracleRow): boolean =>
  [item.position, item.clicks, item.impressions].every(Number.isFinite) && item.position > 0 && item.impressions > 0 && item.clicks >= 0 && item.clicks <= item.impressions;
const naiveCtr = (snapshot: ReturnType<typeof snapshotGscPerformance>) => {
  const rows = snapshot.queries.filter(validForOracle);
  return rows.flatMap(item => {
    if (item.impressions < 100) return [];
    const peers = rows.filter(peer => peer.query !== item.query && Math.abs(peer.position - item.position) <= 1);
    const peerImpressions = peers.reduce((sum, peer) => sum + peer.impressions, 0);
    if (peers.length < 3 || peerImpressions < 300) return [];
    const peerCtr = peers.reduce((sum, peer) => sum + peer.clicks, 0) / peerImpressions * 100;
    const observedCtr = item.clicks / item.impressions * 100;
    if (peerCtr === 0 || observedCtr >= peerCtr * 0.5) return [];
    return [{ query: item.query, position: item.position, impressions: item.impressions, clicks: item.clicks,
      observedCtr, peerCtr, peerImpressions, peerCount: peers.length,
      expectedClickGap: item.impressions * (peerCtr - observedCtr) / 100 }];
  }).sort((a, b) => b.expectedClickGap - a.expectedClickGap || a.query.localeCompare(b.query));
};
it('selects only positions beyond ten through twenty with enough impressions', () => {
  const data = gscData({ queries: [row('ten', 10), row('near', 10.1), row('last', 20), row('far', 20.1), row('few', 12, 1, 99)] });
  expect(findNearTopTenQueries(snapshotGscPerformance(data)).map(r => r.query)).toEqual(['near', 'last']);
});
it('derives CTR benchmark from other observed peers rather than a fixed curve', () => {
  const data = gscData({ queries: [row('low', 5, 1), row('a', 5, 10), row('b', 6, 20), row('c', 4, 30), row('outside', 9, 100)] });
  expect(findCtrOutliers(snapshotGscPerformance(data))).toEqual([{
    query: 'low', position: 5, impressions: 100, clicks: 1, observedCtr: 1,
    peerCtr: 20, peerImpressions: 300, peerCount: 3, expectedClickGap: 19,
  }]);
});
it('requires three peers and at least 300 peer impressions', () => {
  const snapshot = snapshotGscPerformance(gscData({ queries: [row('low', 5, 0), row('a', 5), row('b', 5)] }));
  expect(findCtrOutliers(snapshot)).toEqual([]);
});
it('rejects nonfinite/negative metrics and never mutates the source', () => {
  const snapshot = snapshotGscPerformance(gscData({ queries: [row('bad', NaN), row('negative', 12, -1), row('valid', 12)] }));
  expect(findNearTopTenQueries(snapshot).map(r => r.query)).toEqual(['valid']);
  expect(findCtrOutliers(snapshot)).toEqual([]);
  expect(snapshot.queries[0].query).toBe('bad');
});
it('requires peer impressions independently of peer count and ignores zero CTR cohorts', () => {
  const queries = [row('low', 5, 0), row('a', 5, 1, 90), row('b', 5, 1, 90), row('c', 5, 1, 90)];
  expect(findCtrOutliers(snapshotGscPerformance(gscData({ queries })))).toEqual([]);
  expect(findCtrOutliers(snapshotGscPerformance(gscData({ queries: ['a', 'b', 'c', 'd'].map(q => row(q, 5, 0)) })))).toEqual([]);
});
it('excludes the same query identity, low samples, impossible clicks and nonfinite impressions', () => {
  const queries = [row('low', 5, 0), row('low', 5, 50), row('a', 5, 10), row('b', 5, 10),
    row('few', 5, 0, 5), row('impossible', 5, 101), row('infinite', 5, 1, Infinity)];
  expect(findCtrOutliers(snapshotGscPerformance(gscData({ queries })))).toEqual([]);
});
it('sorts near-top-ten ties by position then query and stronger impressions first', () => {
  const queries = [row('z', 12), row('a', 12), row('later', 13), row('popular', 19, 1, 200)];
  expect(findNearTopTenQueries(snapshotGscPerformance(gscData({ queries }))).map(r => r.query)).toEqual(['popular', 'a', 'z', 'later']);
});
it('sorts equal CTR deficits by query identity and keeps exact half-benchmark boundary', () => {
  const queries = [row('z', 5, 0), row('a', 5, 0), row('peer1', 5, 20), row('peer2', 5, 20), row('peer3', 5, 20)];
  expect(findCtrOutliers(snapshotGscPerformance(gscData({ queries }))).map(r => r.query)).toEqual(['a', 'z']);
  expect(findCtrOutliers(snapshotGscPerformance(gscData({ queries: [row('boundary', 5, 10), ...['a', 'b', 'c'].map(q => row(q, 5, 20))] })))).toEqual([]);
});
it('matches an independent leave-one-out oracle at the inclusive one-position boundary', () => {
  const queries = [row('target', 5, 0), row('at-four', 4, 20), row('at-six', 6, 20), row('peer', 5, 20),
    row('target', 5, 80), row('outside', 7.01, 20), row('invalid', 5, -1)];
  const snapshot = snapshotGscPerformance(gscData({ queries }));
  expect(findCtrOutliers(snapshot)).toEqual(naiveCtr(snapshot));
  expect(findCtrOutliers(snapshot)[0]).toMatchObject({ query: 'target', peerCount: 3, peerImpressions: 300, peerCtr: 20 });
});
it('handles a large in-memory cohort while respecting the 250-row snapshot storage cap', () => {
  const queries = [row('target', 5, 0), ...Array.from({ length: 5000 }, (_, index) => row(`peer-${index}`, 5, 20))];
  const stored = snapshotGscPerformance(gscData({ queries }));
  expect(stored.queries).toHaveLength(250);
  expect(stored.queries_may_be_truncated).toBe(true);
  const result = findCtrOutliers({ ...stored, queries });
  expect(result).toEqual([expect.objectContaining({ query: 'target', peerCount: 5000, peerImpressions: 500000, peerCtr: 20, expectedClickGap: 20 })]);
});
