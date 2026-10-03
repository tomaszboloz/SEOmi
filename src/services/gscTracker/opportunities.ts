import type { GscPerformanceSnapshot } from './types';
type Query = GscPerformanceSnapshot['queries'][number];
export interface CtrOutlier {
  query: string;
  position: number;
  impressions: number;
  clicks: number;
  observedCtr: number;
  peerCtr: number;
  peerImpressions: number;
  peerCount: number;
  expectedClickGap: number;
}
const valid = (row: Query): boolean => [row.position, row.clicks, row.impressions].every(
  value => Number.isFinite(value) && value >= 0,
) && row.position > 0 && row.impressions > 0 && row.clicks <= row.impressions;

/** Average GSC position is a period metric, not a current live SERP rank. */
export function findNearTopTenQueries(snapshot: GscPerformanceSnapshot): Query[] {
  return snapshot.queries.filter(row => valid(row) && row.position > 10 && row.position <= 20 && row.impressions >= 100)
    .sort((a, b) => b.impressions - a.impressions || a.position - b.position || a.query.localeCompare(b.query));
}

/** Leave-one-out weighted peers within one average-position point; no invented CTR curve. */
export function findCtrOutliers(snapshot: GscPerformanceSnapshot): CtrOutlier[] {
  const rows = snapshot.queries.filter(valid);
  return rows.flatMap(row => {
    if (row.impressions < 100) return [];
    const peers = rows.filter(peer => peer.query !== row.query && Math.abs(peer.position - row.position) <= 1);
    const peerImpressions = peers.reduce((sum, peer) => sum + peer.impressions, 0);
    if (peers.length < 3 || peerImpressions < 300) return [];
    const peerCtr = peers.reduce((sum, peer) => sum + peer.clicks, 0) / peerImpressions * 100;
    const observedCtr = row.clicks / row.impressions * 100;
    if (peerCtr === 0 || observedCtr >= peerCtr * 0.5) return [];
    return [{ query: row.query, position: row.position, impressions: row.impressions, clicks: row.clicks,
      observedCtr, peerCtr, peerImpressions, peerCount: peers.length,
      expectedClickGap: row.impressions * (peerCtr - observedCtr) / 100 }];
  }).sort((a, b) => b.expectedClickGap - a.expectedClickGap || a.query.localeCompare(b.query));
}
