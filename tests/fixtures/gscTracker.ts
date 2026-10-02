import type { GscPerformanceData } from '@/types';
export function gscData(extra: Partial<GscPerformanceData> = {}): GscPerformanceData {
  return {
    site_url: 'sc-domain:example.com', start_date: '2026-07-01', end_date: '2026-07-28',
    total_clicks: 100, total_impressions: 1000, avg_ctr: 0.1, avg_position: 8,
    queries: [{ query: 'query', clicks: 100, impressions: 1000, ctr: 0.1, position: 8 }],
    pages: [{ page: 'https://example.com', clicks: 100, impressions: 1000, ctr: 0.1, position: 8 }],
    daily: [], queries_may_be_truncated: false, pages_may_be_truncated: false,
    daily_may_be_truncated: false, max_rows_per_dimension: 25000, ...extra,
  };
}
export function memoryGscStorage(initial = '[]') {
  let stored = initial;
  return { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } };
}
