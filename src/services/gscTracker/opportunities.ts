import type { GscPerformanceSnapshot } from './types';
type Query = GscPerformanceSnapshot['queries'][number];
type QuerySource = Pick<GscPerformanceSnapshot, 'queries'>;
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

/** Average-position window: above `min`, up to and including `max`. */
export interface PositionRange { min: number; max: number }
export const NEAR_TOP_TEN_RANGE: PositionRange = { min: 10, max: 20 };
export const MAX_GSC_POSITION = 100;

/** A usable window (0 <= min < max <= 100); anything else falls back to the default 10-20. */
export const sanitizePositionRange = (value: unknown): PositionRange => {
  const range = value as Partial<PositionRange> | null;
  const min = Number(range?.min);
  const max = Number(range?.max);
  return Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max <= MAX_GSC_POSITION && min < max ? { min, max } : { ...NEAR_TOP_TEN_RANGE };
};

/** Average GSC position is a period metric, not a current live SERP rank. */
export function findNearTopTenQueries(snapshot: QuerySource, range: PositionRange = NEAR_TOP_TEN_RANGE): Query[] {
  return snapshot.queries.filter(row => valid(row) && row.position > range.min && row.position <= range.max && row.impressions >= 100)
    .sort((a, b) => b.impressions - a.impressions || a.position - b.position || a.query.localeCompare(b.query));
}

/** Leave-one-out weighted peers within one average-position point; no invented CTR curve. */
export function findCtrOutliers(snapshot: QuerySource): CtrOutlier[] {
  const rows = snapshot.queries.filter(valid);
  const ordered = rows.map((row, sourceIndex) => ({ row, sourceIndex }))
    .sort((a, b) => a.row.position - b.row.position || a.sourceIndex - b.sourceIndex);
  const positions = ordered.map(item => item.row.position);
  const impressionsPrefix = [0];
  const clicksPrefix = [0];
  const groups = new Map<string, { indexes: number[]; impressions: number[]; clicks: number[] }>();
  ordered.forEach(({ row }, index) => {
    impressionsPrefix.push(impressionsPrefix[index] + row.impressions);
    clicksPrefix.push(clicksPrefix[index] + row.clicks);
    const group = groups.get(row.query) ?? { indexes: [], impressions: [0], clicks: [0] };
    group.indexes.push(index);
    group.impressions.push(group.impressions[group.impressions.length - 1] + row.impressions);
    group.clicks.push(group.clicks[group.clicks.length - 1] + row.clicks);
    groups.set(row.query, group);
  });
  const lowerBound = (values: number[], value: number): number => {
    let low = 0; let high = values.length;
    while (low < high) { const middle = (low + high) >>> 1; if (values[middle] < value) low = middle + 1; else high = middle; }
    return low;
  };
  const positionBound = (center: number, upper: boolean): number => {
    let low = 0; let high = positions.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (upper ? positions[middle] - center <= 1 : center - positions[middle] > 1) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const rangeSum = (prefix: number[], start: number, end: number): number => prefix[end] - prefix[start];
  return ordered.flatMap(({ row, sourceIndex }) => {
    if (row.impressions < 100) return [];
    const start = positionBound(row.position, false);
    const end = positionBound(row.position, true);
    const group = groups.get(row.query)!;
    const duplicateStart = lowerBound(group.indexes, start);
    const duplicateEnd = lowerBound(group.indexes, end);
    const peerCount = end - start - (duplicateEnd - duplicateStart);
    const peerImpressions = rangeSum(impressionsPrefix, start, end)
      - rangeSum(group.impressions, duplicateStart, duplicateEnd);
    if (peerCount < 3 || peerImpressions < 300) return [];
    const peerClicks = rangeSum(clicksPrefix, start, end) - rangeSum(group.clicks, duplicateStart, duplicateEnd);
    const peerCtr = peerClicks / peerImpressions * 100;
    const observedCtr = row.clicks / row.impressions * 100;
    if (peerCtr === 0 || observedCtr >= peerCtr * 0.5) return [];
    return [{ query: row.query, position: row.position, impressions: row.impressions, clicks: row.clicks,
      observedCtr, peerCtr, peerImpressions, peerCount,
      expectedClickGap: row.impressions * (peerCtr - observedCtr) / 100, sourceIndex }];
  }).sort((a, b) => b.expectedClickGap - a.expectedClickGap || a.query.localeCompare(b.query) || a.sourceIndex - b.sourceIndex)
    .map(({ sourceIndex: _sourceIndex, ...outlier }) => outlier);
}
