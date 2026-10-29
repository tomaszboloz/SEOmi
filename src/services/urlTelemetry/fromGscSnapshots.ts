import type { GscPerformanceData, GscPerformanceFilters } from '@/types';
import { readGscSnapshots } from '@/services/gscTracker/read';
import { readGscLastResult } from '@/stores/tools/gscLastResult';
import type { GscPerformanceSnapshot } from '@/services/gscTracker/types';
import { recallGa4Report } from './ga4Cache';
import { readBacklinkTelemetry } from './backlinkPersistence';
import { buildUrlTelemetrySnapshot } from './snapshot';
import { getSnapshot, putSnapshot } from './store';
import type { UrlTelemetrySnapshot } from './types';

/** Legacy snapshots without a daily series keep that evidence explicitly unknown. */
export const performanceDataOf = (snapshot: GscPerformanceSnapshot): GscPerformanceData => ({
  site_url: snapshot.site_url,
  start_date: snapshot.start_date,
  end_date: snapshot.end_date,
  ...(snapshot.filters ? { filters: snapshot.filters } : {}),
  total_clicks: snapshot.total_clicks,
  total_impressions: snapshot.total_impressions,
  avg_ctr: snapshot.avg_ctr,
  avg_position: snapshot.avg_position,
  queries: snapshot.queries,
  pages: snapshot.pages,
  ...(snapshot.query_pages ? { query_pages: snapshot.query_pages, query_pages_may_be_truncated: snapshot.query_pages_may_be_truncated } : {}),
  daily: snapshot.daily ?? [],
  daily_may_be_truncated: snapshot.daily === undefined || (snapshot.daily_may_be_truncated ?? true),
  queries_may_be_truncated: snapshot.queries_may_be_truncated,
  pages_may_be_truncated: snapshot.pages_may_be_truncated,
  max_rows_per_dimension: snapshot.max_rows_per_dimension,
});

/** The most recent period wins; ties go to the later capture. */
export const latestSnapshot = (snapshots: GscPerformanceSnapshot[]): GscPerformanceSnapshot | undefined =>
  [...snapshots].sort((a, b) => b.end_date.localeCompare(a.end_date) || b.captured_at.localeCompare(a.captured_at))[0];

/**
 * Only web search without a device or country filter counts every click a URL gets. A filtered report would
 * turn a URL missing from its rows into a measured zero, which URL protection must never act on.
 */
export const isFullScopeGsc = (filters?: GscPerformanceFilters): boolean =>
  (!filters?.search_type || filters.search_type === 'web') && !filters?.device && !filters?.country?.trim();

interface GscCandidate { data: GscPerformanceData; capturedAt: string }

/** Newest full-scope report among saved snapshots and the last fetched report; later period wins, then later capture. */
export const telemetryGscSource = (projectId: string): GscPerformanceData | undefined => {
  const saved: GscCandidate[] = readGscSnapshots(projectId).filter((snapshot) => isFullScopeGsc(snapshot.filters))
    .map((snapshot) => ({ data: performanceDataOf(snapshot), capturedAt: snapshot.captured_at }));
  const last = readGscLastResult(projectId);
  const fetched: GscCandidate[] = last && isFullScopeGsc(last.data.filters ?? last.filters) ? [{ data: last.data, capturedAt: last.fetchedAt }] : [];
  return [...saved, ...fetched]
    .sort((a, b) => b.data.end_date.localeCompare(a.data.end_date) || b.capturedAt.localeCompare(a.capturedAt))[0]?.data;
};

/**
 * Shared telemetry for a project: the cached one when still valid, otherwise built from the newest full-scope
 * Search Console report (saved snapshot or last fetch), the last persisted Google Analytics report and the
 * persisted backlink sample. Without such a report nothing is built (no zero-filled telemetry).
 */
export const ensureUrlTelemetry = (projectId: string, urls: string[], now: Date = new Date()): UrlTelemetrySnapshot | null => {
  const cached = getSnapshot(projectId, now);
  if (cached) return cached;
  const gsc = telemetryGscSource(projectId);
  const root = urls[0];
  if (!gsc || !root) return null;
  const built = buildUrlTelemetrySnapshot({
    projectId, rootUrl: root, urls, gsc, ga4: recallGa4Report(projectId),
    ...readBacklinkTelemetry(projectId), now,
  });
  if (built) putSnapshot(built);
  return built;
};
