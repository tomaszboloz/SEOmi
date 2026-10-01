import type { GscPerformanceData, GscPerformanceFilters } from '@/types';
import { readStorage, writeStorageResult } from '@/services/storage';
import i18n from '@/i18n';
import { z } from 'zod';

export interface GscDateRange { startDate: string; endDate: string; }

export interface GscPerformanceSnapshot {
  id: string;
  captured_at: string;
  site_url: string;
  start_date: string;
  end_date: string;
  filters?: GscPerformanceFilters;
  total_clicks: number;
  total_impressions: number;
  avg_ctr: number;
  avg_position: number;
  queries: GscPerformanceData['queries'];
  pages: GscPerformanceData['pages'];
  queries_may_be_truncated: boolean;
  pages_may_be_truncated: boolean;
  max_rows_per_dimension: number;
  stored_query_rows: number;
  stored_page_rows: number;
}

export interface GscRowChange {
  key: string;
  clicksDelta: number;
  clicksDeltaPercent: number | null;
  impressionsDelta: number;
  impressionsDeltaPercent: number | null;
  baseline: { clicks: number; impressions: number; ctr: number; position: number };
  current: { clicks: number; impressions: number; ctr: number; position: number };
  potentialDecline: boolean;
}

export interface GscSnapshotComparison {
  compatible: boolean;
  reason?: string;
  queryChanges: GscRowChange[];
  pageChanges: GscRowChange[];
  uncertainBecauseTruncated: boolean;
}

export const MAX_STORED_GSC_ROWS_PER_DIMENSION = 250;
export const MAX_GSC_SNAPSHOTS_PER_PROJECT = 8;

export const gscSnapshotStorageKey = (projectId: string) => `seomi_project_${projectId}_gsc_performance_snapshots_v1`;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const normalizedFilters = (filters?: GscPerformanceFilters): GscPerformanceFilters => ({
  ...(filters?.search_type ? { search_type: filters.search_type } : {}),
  ...(filters?.device ? { device: filters.device } : {}),
  ...(filters?.country?.trim() ? { country: filters.country.trim().toLowerCase() } : {}),
});

const filtersEqual = (left?: GscPerformanceFilters, right?: GscPerformanceFilters): boolean => {
  const a = normalizedFilters(left);
  const b = normalizedFilters(right);
  return (a.search_type || null) === (b.search_type || null)
    && (a.device || null) === (b.device || null)
    && (a.country || null) === (b.country || null);
};

export const latestCompleteGscDateRange = (now = new Date()): GscDateRange => {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: isoDate(start), endDate: isoDate(end) };
};

export const validateGscDateRange = (range: GscDateRange, now = new Date()): string | null => {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
  };
  if (!parse(range.startDate) || !parse(range.endDate)) return i18n.t('runtimeErrors.gsc.invalidDates');
  if (range.startDate > range.endDate) return i18n.t('runtimeErrors.gsc.order');
  const latestAvailable = latestCompleteGscDateRange(now).endDate;
  if (range.endDate > latestAvailable) return i18n.t('runtimeErrors.gsc.latest', { date: latestAvailable });
  return null;
};

export const snapshotGscPerformance = (data: GscPerformanceData, capturedAt = new Date().toISOString()): GscPerformanceSnapshot => {
  const queries = data.queries.slice(0, MAX_STORED_GSC_ROWS_PER_DIMENSION);
  const pages = data.pages.slice(0, MAX_STORED_GSC_ROWS_PER_DIMENSION);
  return {
    id: `${data.site_url}|${data.start_date}|${data.end_date}|${JSON.stringify(normalizedFilters(data.filters))}`,
    captured_at: capturedAt,
    site_url: data.site_url,
    start_date: data.start_date,
    end_date: data.end_date,
    filters: data.filters ? normalizedFilters(data.filters) : {},
    total_clicks: data.total_clicks,
    total_impressions: data.total_impressions,
    avg_ctr: data.avg_ctr,
    avg_position: data.avg_position,
    queries,
    pages,
    queries_may_be_truncated: data.queries_may_be_truncated || data.queries.length > MAX_STORED_GSC_ROWS_PER_DIMENSION,
    pages_may_be_truncated: data.pages_may_be_truncated || data.pages.length > MAX_STORED_GSC_ROWS_PER_DIMENSION,
    max_rows_per_dimension: data.max_rows_per_dimension,
    stored_query_rows: queries.length,
    stored_page_rows: pages.length,
  };
};

const browserGscStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: readStorage,
  setItem: (key, value) => {
    const result = writeStorageResult(key, value);
    if (!result.ok) throw result.error ?? new Error(i18n.t('runtimeErrors.gsc.unavailable'));
  },
};

const gscMetric = z.number().finite().nonnegative();
const gscRowMetrics = { clicks: gscMetric, impressions: gscMetric, ctr: gscMetric, position: gscMetric };
const gscSnapshotSchema: z.ZodType<GscPerformanceSnapshot> = z.object({
  id: z.string(), captured_at: z.string(), site_url: z.string(), start_date: z.string(), end_date: z.string(),
  filters: z.object({
    search_type: z.enum(['web', 'image', 'video', 'news', 'discover', 'googleNews']).optional(),
    device: z.enum(['DESKTOP', 'MOBILE', 'TABLET']).optional(),
    country: z.string().regex(/^[a-z]{3}$/).optional(),
  }).optional(),
  total_clicks: gscMetric, total_impressions: gscMetric, avg_ctr: gscMetric, avg_position: gscMetric,
  queries: z.array(z.object({ query: z.string(), ...gscRowMetrics })).max(MAX_STORED_GSC_ROWS_PER_DIMENSION),
  pages: z.array(z.object({ page: z.string(), ...gscRowMetrics })).max(MAX_STORED_GSC_ROWS_PER_DIMENSION),
  queries_may_be_truncated: z.boolean(), pages_may_be_truncated: z.boolean(),
  max_rows_per_dimension: gscMetric.int(), stored_query_rows: gscMetric.int(), stored_page_rows: gscMetric.int(),
}).refine(value => value.stored_query_rows === value.queries.length && value.stored_page_rows === value.pages.length);

export const readGscSnapshots = (projectId: string, storage: Pick<Storage, 'getItem'> = browserGscStorage): GscPerformanceSnapshot[] => {
  try {
    const value = JSON.parse(storage.getItem(gscSnapshotStorageKey(projectId)) || '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => {
      const result = gscSnapshotSchema.safeParse(item);
      return result.success ? [result.data] : [];
    })
      .slice(0, MAX_GSC_SNAPSHOTS_PER_PROJECT);
  } catch {
    return [];
  }
};

export const saveGscSnapshot = (
  projectId: string,
  data: GscPerformanceData,
  storage: Pick<Storage, 'getItem' | 'setItem'> = browserGscStorage,
  capturedAt = new Date().toISOString(),
): { snapshots: GscPerformanceSnapshot[]; snapshot: GscPerformanceSnapshot } => {
  if (!projectId.trim()) throw new Error(i18n.t('runtimeErrors.schedules.projectRequired'));
  const snapshot = snapshotGscPerformance(data, capturedAt);
  const existing = readGscSnapshots(projectId, storage).filter((item) => !(
    item.site_url === snapshot.site_url
    && item.start_date === snapshot.start_date
    && item.end_date === snapshot.end_date
    && filtersEqual(item.filters, snapshot.filters)
  ));
  const snapshots = [snapshot, ...existing].slice(0, MAX_GSC_SNAPSHOTS_PER_PROJECT);
  storage.setItem(gscSnapshotStorageKey(projectId), JSON.stringify(snapshots));
  return { snapshots, snapshot };
};

const deltaPercent = (previous: number, current: number): number | null => previous > 0 ? ((current - previous) / previous) * 100 : null;

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
  if (baseline.end_date >= current.start_date) return { compatible: false, reason: i18n.t('runtimeErrors.gsc.overlapping'), queryChanges: [], pageChanges: [], uncertainBecauseTruncated: true };
  return {
    compatible: true,
    queryChanges: compareRows(baseline.queries, current.queries, (row) => row.query),
    pageChanges: compareRows(baseline.pages, current.pages, (row) => row.page),
    uncertainBecauseTruncated: baseline.queries_may_be_truncated || baseline.pages_may_be_truncated || current.queries_may_be_truncated || current.pages_may_be_truncated,
  };
};

export const findGscStrikingDistanceQueries = (snapshot: GscPerformanceSnapshot, minImpressions = 100) => snapshot.queries
  .filter((query) => query.position >= 4 && query.position <= 20 && query.impressions >= minImpressions)
  .sort((a, b) => b.impressions - a.impressions || a.position - b.position || a.query.localeCompare(b.query));
