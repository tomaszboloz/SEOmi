import type { GscPerformanceData } from '@/types';
import type { GscPerformanceSnapshot } from './types';
import { MAX_STORED_GSC_ROWS_PER_DIMENSION } from './limits';
import { normalizedFilters } from './filters';

export const snapshotGscPerformance = (data: GscPerformanceData, capturedAt = new Date().toISOString()): GscPerformanceSnapshot => {
  const queries = data.queries.slice(0, MAX_STORED_GSC_ROWS_PER_DIMENSION).map(row => ({ ...row }));
  const pages = data.pages.slice(0, MAX_STORED_GSC_ROWS_PER_DIMENSION).map(row => ({ ...row }));
  const joint = data.query_pages?.slice(0, MAX_STORED_GSC_ROWS_PER_DIMENSION).map(row => ({ ...row }));
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
    ...(joint ? { query_pages: joint,
      query_pages_may_be_truncated: data.query_pages_may_be_truncated === true
        || data.query_pages!.length > MAX_STORED_GSC_ROWS_PER_DIMENSION,
      stored_query_page_rows: joint.length } : {}),
    queries_may_be_truncated: data.queries_may_be_truncated || data.queries.length > MAX_STORED_GSC_ROWS_PER_DIMENSION,
    pages_may_be_truncated: data.pages_may_be_truncated || data.pages.length > MAX_STORED_GSC_ROWS_PER_DIMENSION,
    max_rows_per_dimension: data.max_rows_per_dimension,
    stored_query_rows: queries.length,
    stored_page_rows: pages.length,
  };
};
