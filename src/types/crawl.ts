import type { FaviconData, IssueSeverity, StructuredDataValidationIssue } from './audit';

// -------------------------------------------------------------
// Site Audit Crawler Models
// -------------------------------------------------------------
export interface CrawledPageIssue {
  severity: IssueSeverity;
  message: string;
  /** Stable machine identifier for locally-added findings; copy stays localized. */
  code?: string;
}

export interface CrawledSchemaFinding {
  format: string;
  declaration_index: number;
  finding: StructuredDataValidationIssue;
}

/** Explicit identifiers/relationships retained from bounded structured-data declarations. */
export interface CrawledSchemaReference {
  format: string;
  declaration_index: number;
  property: string;
  value: string;
}

export interface CrawledHtmlValidationFinding {
  code: string;
  severity: string;
  message: string;
  element?: string;
  attribute?: string;
  value?: string;
  line?: number;
  column?: number;
  source_excerpt?: string;
}

export interface CrawledDiscoverySource {
  /** Stable local category: start, seed, sitemap, or link. */
  kind: string;
  /** URL that supplied the discovery, when one exists. */
  source_url?: string | null;
  /** Anchor text for link discoveries, when available. */
  anchor_text?: string | null;
}

export interface CrawledRobotsDecision {
  indexability: 'index' | 'noindex' | string;
  link_following: 'follow' | 'nofollow' | string;
  directives?: string[];
  sources?: string[];
  response_headers_available: boolean;
}

export interface CrawledIndexabilityVerdict {
  status: 'indexable' | 'blocked' | 'uncertain' | string;
  reasons: string[];
}

export interface CrawledContentTerm {
  term: string;
  count: number;
  density_percent: number;
}

export interface CrawledFocusPhraseEvidence {
  phrase: string;
  body_occurrences: number;
  body_density_percent: number;
  title_occurrences: number;
  meta_description_occurrences: number;
  h1_occurrences: number;
}

export interface CrawledPageSummary {
  url: string;
  final_url: string;
  /** Bounded provenance explaining how this URL entered the crawl queue. */
  discovery_sources?: CrawledDiscoverySource[];
  redirect_chain: CrawledRedirectHop[];
  /** Structured reason when redirect traversal stopped before a clean final response. */
  redirect_stop_reason?: string | null;
  depth: number;
  http_status: number;
  /** HTTP response time in HTTP mode; browser Navigation Timing or DOM-capture fallback in rendered mode. */
  response_time_ms: number;
  /** Rendered lab observation; absent for HTTP runs and not equivalent to field/CrUX data. */
  rendered_lcp_ms?: number | null;
  rendered_inp_ms?: number | null;
  rendered_cls?: number | null;
  request_error_kind?: string | null;
  title?: string | null;
  title_length?: number | null;
  meta_description?: string | null;
  meta_description_length?: number | null;
  canonical?: string | null;
  canonical_targets?: CrawledCanonicalTarget[];
  canonical_declaration_count?: number;
  canonical_relation?: string;
  canonical_robots_conflict?: boolean;
  client_redirects?: CrawledClientRedirect[];
  meta_robots?: string | null;
  x_robots_tag?: string | null;
  robots_decision?: CrawledRobotsDecision | null;
  indexability_verdict?: CrawledIndexabilityVerdict | null;
  indexability_status: string;
  content_type?: string | null;
  content_length?: number | null;
  content_encoding?: string | null;
  charset?: string | null;
  detected_charset?: string | null;
  cache_control?: string | null;
  body_truncated: boolean;
  word_count: number;
  text_ratio_percent?: number | null;
  reading_time_minutes?: number | null;
  /** Deterministic local content-complexity indicators from the main document text. */
  sentence_count?: number | null;
  average_words_per_sentence?: number | null;
  average_characters_per_word?: number | null;
  complexity_score?: number | null;
  complexity_label?: string | null;
  readability_ease_score?: number | null;
  readability_grade?: number | null;
  readability_method?: string | null;
  readability_label?: string | null;
  content_terms?: CrawledContentTerm[];
  focus_phrase?: CrawledFocusPhraseEvidence | null;
  content_hash?: string | null;
  /** Local SimHash fingerprint used only for near-duplicate comparison in this crawl. */
  content_simhash?: string | null;
  /** Bounded topical terms from main content, excluding header/footer/nav/sidebar. */
  semantic_terms?: string[];
  /** Bounded semantic-content excerpts retained only for local source-context checks. */
  semantic_excerpts?: string[];
  /** Internal links discovered in main content only for semantic architecture analysis. */
  semantic_links?: CrawledLink[];
  /** Provenance of the content region used for semantic terms/links. */
  semantic_content_source?: 'primary-root' | 'body-fallback' | 'unavailable' | string;
  /** Transport/rendering provenance of the semantic snapshot. */
  semantic_content_provenance?: 'http' | 'rendered' | 'unavailable' | string;
  /** True when semantic evidence was bounded or the source was incomplete. */
  semantic_content_partial?: boolean;
  schema_types: string[];
  /** Bounded identifiers/relationships explicitly declared in structured data. */
  schema_references?: CrawledSchemaReference[];
  schema_syntax_errors: number;
  /** Deterministic local checks with declaration format/index and property path evidence. */
  schema_validation_findings?: CrawledSchemaFinding[];
  schema_validation_truncated?: boolean;
  html_validation_findings?: CrawledHtmlValidationFinding[];
  html_validation_truncated?: boolean;
  document_language?: string | null;
  hreflangs: CrawledHreflang[];
  amp_url?: string | null;
  amp_target_http_status?: number | null;
  amp_target_checked_in_run?: boolean;
  amp_target_canonical_alignment?: 'canonical-to-source' | 'self-canonical' | 'canonical-points-elsewhere' | 'missing-canonical' | null;
  h1_count: number;
  heading_counts?: number[];
  duplicate_headings?: CrawledDuplicateHeading[];
  pagination_next?: string | null;
  pagination_prev?: string | null;
  pagination_links?: CrawledPaginationLink[];
  pagination_declaration_count?: number;
  pagination_invalid_declaration_count?: number;
  pagination_canonical_alignment?: string | null;
  internal_link_count: number;
  external_link_count: number;
  links: CrawledLink[];
  images: CrawledImage[];
  /** iframe declarations found in fetched HTML; not a browser-rendered frame tree. */
  frames?: CrawledFrame[];
  frames_truncated?: boolean;
  favicons?: string[];
  /** Bounded favicon declarations; absent on legacy crawl snapshots. */
  favicon_metadata?: FaviconData[];
  favicon_resource_checks?: CrawledSocialResourceCheck[];
  social_meta_tags?: CrawledSocialMetaTag[];
  custom_search_results?: CrawledCustomSearchResult[];
  issues_count: number;
  issues: CrawledPageIssue[];
}

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

export interface CrawledImage {
  src: string;
  alt?: string;
  srcset?: string;
  format?: string;
  width?: number;
  height?: number;
  /** Explains whether dimensions came from HTML attributes or local data URI evidence. */
  dimensions_source?: 'attributes' | 'intrinsic-data-uri' | 'mixed' | string;
  lazy_loaded: boolean;
  /** Only true when the optional image-resource request completed in this run. */
  checked_in_run?: boolean;
  http_status?: number | null;
  content_length?: number | null;
  request_error_kind?: string | null;
  srcset_resource_checks?: CrawledImageResourceCheck[];
  srcset_resource_checks_truncated?: boolean;
}

export interface CrawledImageResourceCheck {
  url: string;
  checked_in_run: boolean;
  http_status?: number | null;
  content_length?: number | null;
  request_error_kind?: string | null;
}

export interface CrawledFrame {
  src?: string;
  resolved_url?: string;
  title?: string;
  name?: string;
  loading?: string;
  sandbox?: string;
  checked_in_run?: boolean;
  http_status?: number;
  request_error_kind?: string;
}

export interface CrawledSocialMetaTag {
  key: string;
  /** Missing content and explicitly empty content remain distinct. */
  content?: string | null;
  resource_check?: CrawledSocialResourceCheck | null;
}

export interface CrawledSocialResourceCheck {
  url: string;
  checked_in_run: boolean;
  http_status?: number | null;
  content_type?: string | null;
  content_length?: number | null;
  intrinsic_width?: number | null;
  intrinsic_height?: number | null;
  dimensions_source?: 'intrinsic-http' | string | null;
  request_error_kind?: string | null;
}

export interface SiteCrawlResult {
  start_url: string;
  /** Missing on legacy snapshots means HTTP-only; browser-rendered runs stay separately tagged. */
  crawl_mode?: 'http' | 'browser-rendered';
  pages_crawled: number;
  health_score: number;
  critical_count: number;
  warning_count: number;
  notice_count: number;
  pages: CrawledPageSummary[];
  duration_ms: number;
  cancelled: boolean;
  timed_out?: boolean;
  robots_txt_status: string;
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

export interface CrawlConfig {
  crawlMode?: 'http' | 'browser-rendered';
  renderWaitForSelector?: string;
  renderWaitDelayMs?: number;
  renderLazyScrollCycles?: number;
  maxPages?: number;
  maxDepth?: number;
  includePatterns: string[];
  excludePatterns: string[];
  allowSubdomains: boolean;
  /** Explicit host allowlist for additional crawl targets (host names only). */
  allowedHosts?: string[];
  scopePath?: string;
  keepQueryStrings: boolean;
  respectRobots: boolean;
  respectCrawlDelay: boolean;
  discoverSitemaps: boolean;
  maxRedirects?: number;
  followNofollow: boolean;
  maxResponseBytes?: number;
  maxRunSeconds?: number;
  requestTimeoutSecs?: number;
  verifySsl?: boolean;
  seedUrls?: string[];
  listMode?: boolean;
  /** User agent saved with the non-secret project profile. */
  userAgent?: string;
  /** Metadata only; its headers and cookies live in the OS credential store. */
  requestProfileId?: string;
  /** Optional, explicit URL normalization choices. Defaults preserve existing paths and query strings. */
  trimTrailingSlash?: boolean;
  lowercasePath?: boolean;
  stripTrackingParameters?: boolean;
  allowedQueryParameters?: string[];
  deniedQueryParameters?: string[];
  customSearches?: CustomSearchDefinition[];
  /** Optional phrase evidence evaluated per crawled URL. */
  focusPhrase?: string;
  crawlImages?: boolean;
  crawlStylesheets?: boolean;
  crawlScripts?: boolean;
  crawlOtherResources?: boolean;
  maxResourceRequests?: number;
  /** Maximum number of optional resource requests in flight at once. */
  maxConcurrentRequests?: number;
  /** Internal bounded checkpoint used only when explicitly resuming a partial crawl. */
  resumeCompletedUrls?: string[];
  /** Internal bounded frontier captured from the partial crawl. */
  resumeFrontierUrls?: string[];
}

export interface CustomSearchDefinition {
  id: string;
  name: string;
  selectorType: 'css' | 'xpath' | 'regex';
  query: string;
  resultType: 'text' | 'html' | 'attribute';
  attribute?: string;
}

export interface CrawledCustomSearchResult {
  id: string;
  values: string[];
  error?: string | null;
  truncated: boolean;
}

export interface CrawlRequestProfile {
  id: string;
  name: string;
  userAgent: string;
  /** These are non-secret capability flags; endpoints and values stay in the keychain. */
  hasProxy: boolean;
  /** Non-secret capability metadata used to explain renderer compatibility. */
  hasHeaders?: boolean;
  hasCookie?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrawlFilterValidationError {
  filter: 'include' | 'exclude' | string;
  pattern: string;
  message: string;
}

export interface CrawlFilterPreview {
  url: string;
  included: boolean;
  reason: string;
}

export interface CrawlFilterValidationResult {
  valid: boolean;
  errors: CrawlFilterValidationError[];
  previews: CrawlFilterPreview[];
}

export interface CrawlProgress {
  runId: string;
  currentUrl?: string;
  discovered: number;
  completed: number;
  queued: number;
  cancelled: boolean;
  paused: boolean;
  /** Monotonic elapsed time measured by the crawler, not wall-clock input. */
  elapsedMs?: number;
  /** Completed pages per second over the current crawl window. */
  pagesPerSecond?: number;
}

export type CrawlEnvironment = 'default' | 'staging' | 'production';

export interface CrawlRunRecord {
  id: string;
  completedAt: string;
  startUrl: string;
  config: CrawlConfig;
  result: SiteCrawlResult;
  /** Optional environment label used by paired staging/production comparisons. */
  environment?: 'default' | 'staging' | 'production';
  /** True when persistence had to bound verbose evidence to recover from a storage quota. */
  storage_compacted?: boolean;
}
