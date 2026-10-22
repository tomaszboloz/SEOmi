import type { TrafficMetrics } from './trafficEvidence';

const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * Two GSC rows that normalize to the same URL describe one page: clicks and
 * impressions add up, CTR is recomputed, position is weighted by impressions.
 */
export const mergeGscPageRows = (left: TrafficMetrics, right: TrafficMetrics): TrafficMetrics => {
  const clicks = (left.clicks ?? 0) + (right.clicks ?? 0);
  const impressions = (left.impressions ?? 0) + (right.impressions ?? 0);
  const leftPosition = left.position ?? 0;
  const rightPosition = right.position ?? 0;
  const position = impressions > 0
    ? (leftPosition * (left.impressions ?? 0) + rightPosition * (right.impressions ?? 0)) / impressions
    : (leftPosition + rightPosition) / 2;
  return { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0, position: round(position, 2) };
};
