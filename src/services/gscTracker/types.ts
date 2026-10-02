import type { GscPerformanceData, GscPerformanceFilters } from '@/types';

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

