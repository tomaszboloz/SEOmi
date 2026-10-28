import type { GscPerformanceData, GscPerformanceFilters } from '@/types';
import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { filtersEqual } from '@/services/gscTracker/filters';

export const gscLastResultKey = (projectId: string) => `seomi_gsc_last_result_${projectId}_v1`;

export interface GscLastResult { data: GscPerformanceData; fetchedAt: string; filters: GscPerformanceFilters }

const isRows = (value: unknown): boolean => Array.isArray(value);
const isReport = (value: unknown): value is GscPerformanceData => {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.site_url === 'string' && typeof data.start_date === 'string' && typeof data.end_date === 'string'
    && ['total_clicks', 'total_impressions', 'avg_ctr', 'avg_position'].every((key) => typeof data[key] === 'number')
    && isRows(data.queries) && isRows(data.pages) && isRows(data.daily);
};

/** The last report fetched for this project, whatever its scope; damaged storage gives null. */
export const readGscLastResult = (projectId: string): GscLastResult | null => {
  if (!projectId) return null;
  const stored = readJsonStorage(gscLastResultKey(projectId), null);
  if (!stored || typeof stored !== 'object') return null;
  const { data, fetchedAt, filters } = stored as Partial<GscLastResult>;
  if (!isReport(data) || typeof fetchedAt !== 'string' || Number.isNaN(Date.parse(fetchedAt))) return null;
  return { data, fetchedAt, filters: filters ?? {} };
};

/**
 * The last report fetched for this project, only when it answers the same property and filters the user has
 * selected now, so a remembered report never stands in for a different scope.
 */
export const loadGscLastResult = (projectId: string, property: string, filters: GscPerformanceFilters | undefined): GscLastResult | null => {
  const last = property ? readGscLastResult(projectId) : null;
  return last && last.data.site_url === property && filtersEqual(last.filters, filters) ? last : null;
};

/** Best effort: a report too large for storage stays in memory only. */
export const saveGscLastResult = (projectId: string, result: GscLastResult): boolean =>
  Boolean(projectId) && writeJsonStorage(gscLastResultKey(projectId), result);

export const clearGscLastResult = (projectId: string): void => { removeStorage(gscLastResultKey(projectId)); };

/** Store fields for the remembered report of the given scope, or an empty report. */
export const rememberedGscData = (projectId: string, property: string, filters: GscPerformanceFilters | undefined) => {
  const last = loadGscLastResult(projectId, property, filters);
  return { gscData: last?.data ?? null, gscDataFetchedAt: last?.fetchedAt ?? null };
};
