import type { GscPerformanceData } from '@/types';
import { readGscSnapshots } from '@/services/gscTracker/read';
import type { GscPerformanceSnapshot } from '@/services/gscTracker/types';
import { recallGa4Report } from './ga4Cache';
import { buildUrlTelemetrySnapshot } from './snapshot';
import { getSnapshot, putSnapshot } from './store';
import type { UrlTelemetrySnapshot } from './types';

/** A stored snapshot keeps the aggregates and row tables; the daily series is not stored, so it is flagged unknown. */
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
  daily: [],
  daily_may_be_truncated: true,
  queries_may_be_truncated: snapshot.queries_may_be_truncated,
  pages_may_be_truncated: snapshot.pages_may_be_truncated,
  max_rows_per_dimension: snapshot.max_rows_per_dimension,
});

/** The most recent period wins; ties go to the later capture. */
export const latestSnapshot = (snapshots: GscPerformanceSnapshot[]): GscPerformanceSnapshot | undefined =>
  [...snapshots].sort((a, b) => b.end_date.localeCompare(a.end_date) || b.captured_at.localeCompare(a.captured_at))[0];

/**
 * Shared telemetry for a project: the cached one when still valid, otherwise built from the newest saved
 * Search Console snapshot, plus the session's last Google Analytics report when there is one. Without a saved snapshot nothing is built (no zero-filled telemetry).
 */
export const ensureUrlTelemetry = (projectId: string, urls: string[], now: Date = new Date()): UrlTelemetrySnapshot | null => {
  const cached = getSnapshot(projectId, now);
  if (cached) return cached;
  const source = latestSnapshot(readGscSnapshots(projectId));
  const root = urls[0];
  if (!source || !root) return null;
  const built = buildUrlTelemetrySnapshot({ projectId, rootUrl: root, urls, gsc: performanceDataOf(source), ga4: recallGa4Report(projectId), now });
  if (built) putSnapshot(built);
  return built;
};
