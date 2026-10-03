import type { GscPerformanceSnapshot, GscSnapshotComparison, GscRowChange } from './types';
import { filtersEqual } from './filters';
import i18n from '@/i18n';

const deltaPercent = (previous: number, current: number): number | null => previous > 0 ? ((current - previous) / previous) * 100 : null;

const windowDays = (snapshot: GscPerformanceSnapshot): number | null => {
  const values = [snapshot.start_date, snapshot.end_date];
  const timestamps = values.map(value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed.getTime() : NaN;
  });
  if (timestamps.some(value => !Number.isFinite(value)) || timestamps[0] > timestamps[1]) return null;
  return (timestamps[1] - timestamps[0]) / 86400000 + 1;
};

const onlyIn = (first: string[], second: string[]): string[] => {
  const observed = new Set(second);
  return [...new Set(first)].filter(key => !observed.has(key)).sort((a, b) => a.localeCompare(b));
};

const compareRows = <T extends { clicks: number; impressions: number; ctr: number; position: number }>(
  baselineRows: T[],
  currentRows: T[],
  key: (row: T) => string,
): GscRowChange[] => {
  const baselineByKey = new Map(baselineRows.map((row) => [key(row), row]));
  return currentRows.flatMap((current) => {
    const rowKey = key(current);
    const baseline = baselineByKey.get(rowKey);
    if (!baseline) return [];
    const clicksDelta = current.clicks - baseline.clicks;
    const impressionsDelta = current.impressions - baseline.impressions;
    const clicksDeltaPercent = deltaPercent(baseline.clicks, current.clicks);
    const impressionsDeltaPercent = deltaPercent(baseline.impressions, current.impressions);
    const potentialDecline = baseline.impressions >= 100 && (
      (clicksDeltaPercent !== null && clicksDeltaPercent <= -20)
      || (impressionsDeltaPercent !== null && impressionsDeltaPercent <= -20)
    );
    return [{
      key: rowKey,
      clicksDelta,
      clicksDeltaPercent,
      impressionsDelta,
      impressionsDeltaPercent,
      baseline: { clicks: baseline.clicks, impressions: baseline.impressions, ctr: baseline.ctr, position: baseline.position },
      current: { clicks: current.clicks, impressions: current.impressions, ctr: current.ctr, position: current.position },
      potentialDecline,
    }];
  }).sort((a, b) => a.clicksDelta - b.clicksDelta || a.impressionsDelta - b.impressionsDelta || a.key.localeCompare(b.key));
};

export const compareGscSnapshots = (baseline: GscPerformanceSnapshot, current: GscPerformanceSnapshot): GscSnapshotComparison => {
  if (baseline.site_url !== current.site_url) return { compatible: false, reason: i18n.t('runtimeErrors.gsc.differentProperties'), queryChanges: [], pageChanges: [], uncertainBecauseTruncated: true };
  if (!filtersEqual(baseline.filters, current.filters)) return { compatible: false, reason: i18n.t('runtimeErrors.gsc.differentFilters'), queryChanges: [], pageChanges: [], uncertainBecauseTruncated: true };
  if (baseline.id === current.id) return { compatible: false, reason: i18n.t('runtimeErrors.gsc.samePeriod'), queryChanges: [], pageChanges: [], uncertainBecauseTruncated: true };
  const baselineDays = windowDays(baseline);
  const currentDays = windowDays(current);
  if (baselineDays === null || currentDays === null) return { compatible: false, reason: i18n.t('runtimeErrors.gsc.invalidDates'), queryChanges: [], pageChanges: [], uncertainBecauseTruncated: true };
  if (baseline.end_date >= current.start_date) return { compatible: false, reason: i18n.t('runtimeErrors.gsc.overlapping'), queryChanges: [], pageChanges: [], uncertainBecauseTruncated: true };
  if (baselineDays !== currentDays) return { compatible: false, reason: i18n.t('runtimeErrors.gsc.differentDurations'), queryChanges: [], pageChanges: [], uncertainBecauseTruncated: true };
  return {
    compatible: true,
    queryChanges: compareRows(baseline.queries, current.queries, (row) => row.query),
    pageChanges: compareRows(baseline.pages, current.pages, (row) => row.page),
    uncertainBecauseTruncated: baseline.queries_may_be_truncated || baseline.pages_may_be_truncated || current.queries_may_be_truncated || current.pages_may_be_truncated,
    unmatchedRows: {
      baselineQueries: onlyIn(baseline.queries.map(row => row.query), current.queries.map(row => row.query)),
      currentQueries: onlyIn(current.queries.map(row => row.query), baseline.queries.map(row => row.query)),
      baselinePages: onlyIn(baseline.pages.map(row => row.page), current.pages.map(row => row.page)),
      currentPages: onlyIn(current.pages.map(row => row.page), baseline.pages.map(row => row.page)),
    },
  };
};

export const findGscStrikingDistanceQueries = (snapshot: GscPerformanceSnapshot, minImpressions = 100) => snapshot.queries
  .filter((query) => query.position >= 4 && query.position <= 20 && query.impressions >= minImpressions)
  .sort((a, b) => b.impressions - a.impressions || a.position - b.position || a.query.localeCompare(b.query));
