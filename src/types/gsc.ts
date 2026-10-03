export interface GscMetricRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPerformanceData {
  site_url: string;
  start_date: string;
  end_date: string;
  /** Exact Search Analytics scope used for this report. */
  filters?: GscPerformanceFilters;
  total_clicks: number;
  total_impressions: number;
  avg_ctr: number;
  avg_position: number;
  queries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
  /** Observed joint query/page rows; absent in legacy reports, never inferred from marginals. */
  query_pages?: GscMetricRow[];
  query_pages_may_be_truncated?: boolean;
  daily: { date: string; clicks: number; impressions: number; ctr: number; position: number }[];
  daily_may_be_truncated: boolean;
  queries_may_be_truncated: boolean;
  pages_may_be_truncated: boolean;
  max_rows_per_dimension: number;
}

export type GscSearchType = 'web' | 'image' | 'video' | 'news' | 'discover' | 'googleNews';

export type GscDevice = 'DESKTOP' | 'MOBILE' | 'TABLET';

export interface GscPerformanceFilters {
  search_type?: GscSearchType;
  device?: GscDevice;
  /** ISO 3166-1 alpha-3 country code, normalized to lowercase for Google. */
  country?: string;
}

export interface GscSiteProperty {
  siteUrl: string;
  permissionLevel: string;
}
