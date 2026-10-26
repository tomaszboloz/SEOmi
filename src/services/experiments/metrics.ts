import type { GscPerformanceSnapshot } from '@/services/gscTracker/types';
import { scopeOf, urlKey } from '@/services/urlTelemetry/urlKey';
import type { ExperimentChange, Metrics } from './types';

export const totals = (snapshot: GscPerformanceSnapshot): Metrics => ({
  clicks: snapshot.total_clicks, impressions: snapshot.total_impressions,
  position: snapshot.total_impressions > 0 ? snapshot.avg_position : null,
});

export const pageMetrics = (snapshot: GscPerformanceSnapshot, url: string): Metrics | null => {
  const scope = scopeOf(url);
  if (!scope) return null;
  const key = urlKey(url, url, scope);
  const rows = snapshot.pages.filter(row => urlKey(row.page, url, scope) === key);
  if (!rows.length && snapshot.pages_may_be_truncated) return null;
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weighted = rows.reduce((sum, row) => sum + row.position * row.impressions, 0);
  return { clicks, impressions, position: impressions > 0 ? weighted / impressions : null };
};

export const subtractPage = (site: Metrics, page: Metrics): Metrics | null => {
  const clicks = site.clicks - page.clicks;
  const impressions = site.impressions - page.impressions;
  if (clicks < 0 || impressions < 0) return null;
  const weighted = (site.position ?? 0) * site.impressions - (page.position ?? 0) * page.impressions;
  return { clicks, impressions, position: impressions > 0 && weighted >= 0 ? weighted / impressions : null };
};

export const compareMetrics = (before: Metrics, after: Metrics): ExperimentChange => {
  const metric = (key: 'clicks' | 'impressions') => ({
    before: before[key], after: after[key], absoluteChange: after[key] - before[key],
    relativeChange: before[key] > 0 ? (after[key] - before[key]) / before[key] * 100 : null,
  });
  return {
    clicks: metric('clicks'), impressions: metric('impressions'),
    position: {
      before: before.position, after: after.position,
      absoluteChange: before.position !== null && after.position !== null ? after.position - before.position : null,
    },
  };
};
