export interface CrawledLink {
  target_url: string;
  anchor_text: string;
  rel?: string;
  is_internal: boolean;
  /** Bounded, redacted source element excerpt for locating the link in HTML. */
  source_excerpt?: string;
  target_http_status?: number;
  target_response_time_ms?: number;
  target_redirect_url?: string;
  target_request_error_kind?: string;
  target_checked_at?: string;
  /** DOM placement from the crawler; absent in older runs. Not a fold claim without a render. */
  zone?: string | null;
  /** How `zone` was decided, e.g. `dom-ancestry`. */
  zone_method?: string | null;
  /** Up to 15 words before/after the anchor in its block element. */
  context_before?: string | null;
  context_after?: string | null;
  /** True when the block held more than 15 words on a side, so the context is cut (GEM-70-02); absent in older runs. */
  context_truncated?: boolean;
  /** Visible words before the anchor in its block; absent in older runs. */
  context_anchor_offset?: number | null;
  /** Nearest H2/H3 before the anchor; absent in older runs. */
  section_heading?: string | null;
}

export interface ExternalLinkCheckBatchResult {
  requested: number;
  checked: number;
  omitted: number;
  results: Array<{
    url: string;
    httpStatus?: number;
    responseTimeMs?: number;
    redirectUrl?: string;
    requestErrorKind?: string;
    checkedAt: string;
  }>;
}

export interface ExternalLinkCheckProgress {
  requestId: string;
  completed: number;
  total: number;
  currentUrl: string;
  httpStatus?: number;
  requestErrorKind?: string;
}
