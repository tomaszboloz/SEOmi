import type { CrawledPageSummary } from './page';

export interface SiteCrawlResult {
  start_url: string;
  /** Missing on legacy snapshots means HTTP-only; browser-rendered runs stay separately tagged. */
  crawl_mode?: 'http' | 'browser-rendered';
  pages_crawled: number;
  health_score: number;
  /** Missing/zero means the stored score predates formula versioning. */
  score_version?: number;
  critical_count: number;
  warning_count: number;
  notice_count: number;
  pages: CrawledPageSummary[];
  duration_ms: number;
  cancelled: boolean;
  timed_out?: boolean;
  robots_txt_status: string;
  /** Machine-readable robots outcome: loaded, unrestricted, unknown or disabled. */
  robots_txt_evaluation_status?: 'loaded' | 'unrestricted' | 'unknown' | 'disabled' | string;
  /** Prominent run-level warning when robots rules could not be evaluated. */
  robots_txt_warning?: string | null;
  robots_txt_status_code?: number | null;
  robots_txt_final_url?: string | null;
  robots_txt_redirect_chain?: Array<{
    from_url: string;
    http_status: number;
    to_url: string;
    response_time_ms?: number | null;
  }>;
  robots_user_agent?: string;
  robots_applicable_rules?: Array<{ directive: string; path: string }>;
  /** Same robots.txt response evaluated for a bounded set of crawler identities. */
  robots_agent_matrix?: Array<{
    user_agent: string;
    specific_group: boolean;
    applicable_rules: Array<{ directive: string; path: string }>;
    crawl_delay_ms?: number | null;
  }>;
  robots_sitemap_directives?: string[];
  robots_blocked_count: number;
  sitemap_status: string;
  sitemap_urls_discovered: number;
  sitemap_urls: string[];
  rejected_urls?: Array<{ url: string; reason: string }>;
  resources?: CrawledResource[];
  resource_limit_reached?: boolean;
  /** True when durable storage retained only a bounded page index after a quota failure. */
  storage_pages_truncated?: boolean;
  /** Number of pages in the in-memory result before durable compaction. */
  storage_pages_total?: number;
  /** True when bounded discovery provenance dropped one or more sources/targets. */
  discovery_provenance_truncated?: boolean;
  /** Machine-readable caps observed while producing this bounded run. */
  limit_reasons?: string[];
}

export interface CrawledResource {
  source_urls: string[];
  url: string;
  resource_type: 'image' | 'stylesheet' | 'script' | 'other' | string;
  http_status?: number;
  content_type?: string;
  content_length?: number;
  /** Dimensions decoded from a bounded, non-persisted image response prefix. */
  intrinsic_width?: number;
  intrinsic_height?: number;
  dimensions_source?: 'intrinsic-http' | string;
  /** Native HTTP time to response headers/error; not browser resource timing. */
  response_time_ms?: number;
  request_error_kind?: string;
}

export interface RenderedPageArtifact {
  requestedUrl: string;
  finalUrl: string;
  runId?: string | null;
  capturedAt: string;
  artifactType: 'screenshot' | 'pdf';
  contentType: string;
  fileName: string;
  bytes: number;
  dataBase64: string;
  rendererPlatform: string;
}
