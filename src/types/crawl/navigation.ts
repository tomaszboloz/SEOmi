export interface CrawledRedirectHop {
  from_url: string;
  http_status: number;
  to_url: string;
  /** Time spent waiting for this redirect response; absent in legacy snapshots. */
  response_time_ms?: number | null;
}

export interface CrawledCanonicalTarget {
  url: string;
  relation: string;
  http_status?: number | null;
  checked_in_run: boolean;
}

export interface CrawledClientRedirect {
  source: 'meta-refresh' | 'http-refresh' | string;
  declaration: string;
  delay_seconds?: number | null;
  target_url?: string | null;
}

export interface CrawledHreflang {
  language: string;
  target_url: string;
  target_http_status?: number | null;
  target_checked_in_run?: boolean;
  reciprocal_in_run?: boolean | null;
  target_canonical_alignment?: string | null;
}

export interface CrawledDuplicateHeading {
  text: string;
  levels: number[];
  occurrences: number;
}

export interface CrawledPaginationLink {
  relation: 'next' | 'prev' | string;
  target_url: string;
  query_parameter_changes: string[];
  http_status?: number | null;
  checked_in_run: boolean;
  /** Whether the target page declares the opposite relation back in this run. */
  reciprocal_in_run?: boolean | null;
}
