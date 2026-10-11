export type Ga4Status = 'complete' | 'missing' | 'partial';

export interface Ga4Property {
  name: string;
  display_name?: string | null;
  stream_urls: string[];
}

export interface Ga4ReportRow {
  host_name: string;
  landing_page: string;
  sessions: number;
  engaged_sessions: number;
  key_events: number;
}

export interface Ga4Report {
  property: string;
  start_date: string;
  end_date: string;
  rows: Ga4ReportRow[];
  may_be_truncated: boolean;
  row_count: number | null;
  status?: Ga4Status;
  host_name?: string;
  pages?: number;
}

export interface Ga4Discovery {
  status: Ga4Status;
  property: Ga4Property | null;
  account_pages: number;
  stream_pages: number;
  candidates_checked: number;
  may_be_truncated: boolean;
}

export interface Ga4Snapshot {
  status: Ga4Status;
  start_date: string;
  end_date: string;
  discovery: Ga4Discovery;
  report: Ga4Report | null;
}

export interface Ga4DateRange {
  startDate: string;
  endDate: string;
}

export interface Ga4JoinedRow extends Ga4ReportRow {
  gsc?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  crawl_issue_count?: number;
}

export interface Ga4JoinResult {
  rows: Ga4JoinedRow[];
  matched_gsc_rows: number;
  matched_crawl_rows: number;
  gsc_period_matches: boolean;
  warnings: string[];
}
