import type { PageSpeedReport } from '@/services/pagespeed';

import { PageSpeedSnapshot, PageSpeedComparison } from "./contracts";

export const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export const categoryKeys: Array<keyof PageSpeedReport['categories']> = ['performance', 'accessibility', 'bestPractices', 'seo'];

export const metricIds = ['first-contentful-paint', 'largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'speed-index', 'interactive'];

export const cruxMetricIds = ['largest_contentful_paint', 'interaction_to_next_paint', 'cumulative_layout_shift', 'first_contentful_paint', 'experimental_time_to_first_byte'];

export const psiMetricValue = (snapshot: PageSpeedSnapshot, id: string): number | null => numeric(snapshot.pageSpeed?.metrics?.[id]?.numericValue);

export const cruxMetricValue = (snapshot: PageSpeedSnapshot, id: string): number | null => {
  const metrics = (snapshot.crux?.response as Record<string, unknown> | undefined)?.record as Record<string, unknown> | undefined;
  const metric = metrics?.metrics && typeof metrics.metrics === 'object' ? (metrics.metrics as Record<string, unknown>)[id] : null;
  if (!metric || typeof metric !== 'object') return null;
  const percentiles = (metric as Record<string, unknown>).percentiles;
  return percentiles && typeof percentiles === 'object' ? numeric((percentiles as Record<string, unknown>).p75) : null;
};

export const delta = (baseline: number | null, current: number | null) => baseline === null || current === null ? null : current - baseline;

export const comparePageSpeedSnapshots = (baseline: PageSpeedSnapshot, current: PageSpeedSnapshot): PageSpeedComparison => ({
  baseline,
  current,
  categoryDeltas: categoryKeys.map((key) => {
    const baselineValue = numeric(baseline.pageSpeed?.categories?.[key]);
    const currentValue = numeric(current.pageSpeed?.categories?.[key]);
    return { key, baseline: baselineValue, current: currentValue, delta: delta(baselineValue, currentValue) };
  }),
  metricDeltas: metricIds.map((id) => {
    const baselineValue = psiMetricValue(baseline, id);
    const currentValue = psiMetricValue(current, id);
    return { id, baseline: baselineValue, current: currentValue, delta: delta(baselineValue, currentValue) };
  }),
  cruxDeltas: cruxMetricIds.map((id) => {
    const baselineValue = cruxMetricValue(baseline, id);
    const currentValue = cruxMetricValue(current, id);
    return { id, baseline: baselineValue, current: currentValue, delta: delta(baselineValue, currentValue) };
  }),
});
