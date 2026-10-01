export type IssueSeverity = 'Critical' | 'Warning' | 'Info';

export type IssueCategory =
  | 'MetaTags'
  | 'OpenGraph'
  | 'TwitterCard'
  | 'Headings'
  | 'Images'
  | 'Links'
  | 'Security'
  | 'Performance'
  | 'Technical'
  | 'StructuredData';

export interface Issue {
  severity: IssueSeverity;
  category: IssueCategory;
  /** Stable backend identifier for localized audit findings. */
  code?: string;
  /** Values used by the localized message/recommendation templates. */
  params?: Record<string, string>;
  message: string;
  recommendation?: string;
}

export interface RedirectHop {
  url: string;
  status_code: u16;
  location?: string;
}

export type u16 = number;
export type u8 = number;

export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface MetaTags {
  title?: string;
  title_length: number;
  description?: string;
  description_length: number;
  keywords?: string;
  robots?: string;
  canonical?: string;
  viewport?: string;
  charset?: string;
  author?: string;
  generator?: string;
  theme_color?: string;
  other_tags: MetaTag[];
}

export interface OpenGraphData {
  og_title?: string;
  og_description?: string;
  og_image?: string;
  og_image_width?: string;
  og_image_height?: string;
  og_url?: string;
  og_type?: string;
  og_site_name?: string;
  og_locale?: string;
  all_tags: MetaTag[];
}

export interface TwitterCardData {
  twitter_card?: string;
  twitter_site?: string;
  twitter_creator?: string;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string;
  all_tags: MetaTag[];
}

export interface HeadingNode {
  level: number;
  text: string;
  children: HeadingNode[];
}

export interface HeadingsStructure {
  h1_count: number;
  h1_texts: string[];
  hierarchy: HeadingNode[];
  has_valid_hierarchy: boolean;
  issues: string[];
}

export interface ImageData {
  src: string;
  alt?: string;
  width?: string;
  height?: string;
  loading?: string;
  srcset?: string;
  has_alt: boolean;
  format?: string;
  dimensions_source?: 'attributes' | 'intrinsic-data-uri' | 'mixed' | string;
}

export interface LinkData {
  href: string;
  text: string;
  is_internal: boolean;
  rel?: string;
  target?: string;
  is_insecure?: boolean;
}

export interface LinksAnalysis {
  total_links: number;
  internal_links: number;
  external_links: number;
  nofollow_links: number;
  links: LinkData[];
}

export interface SecurityHeaders {
  strict_transport_security?: string;
  content_security_policy?: string;
  x_frame_options?: string;
  x_content_type_options?: string;
  referrer_policy?: string;
  permissions_policy?: string;
  cross_origin_opener_policy?: string;
  cross_origin_resource_policy?: string;
  server?: string;
  x_powered_by?: string;
  score: number;
}

export interface CookieSecurityFinding {
  name: string;
  secure: boolean;
  http_only: boolean;
  same_site?: string | null;
}

export interface TransportSecurityAudit {
  scheme: string;
  https: boolean;
  mixed_content_urls: string[];
  cookies: CookieSecurityFinding[];
  tls_coverage: string;
}

export interface StructuredData {
  data_type: string;
  format: string;
  content: Record<string, unknown>;
  validation_issues?: StructuredDataValidationIssue[];
}

export interface StructuredDataValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  recommendation?: string;
}

export interface HreflangTag {
  hreflang: string;
  href: string;
}

export interface TechnicalData {
  content_type?: string;
  server?: string;
  favicon?: string;
  favicons?: FaviconData[];
  robots_txt_url?: string;
  sitemap_url?: string;
  hreflang_tags: HreflangTag[];
  technology_signals?: TechnologySignal[];
}

export interface FaviconData {
  href: string;
  rel: string;
  declared_type?: string;
  declared_sizes?: string;
  inferred_format?: string;
}

export interface TechnologySignal {
  name: string;
  category: string;
  evidence: string;
  confidence: 'confirmed' | 'heuristic';
  version?: string | null;
}

export interface AccessibilityLandmark {
  name: string;
  count: number;
}

export interface AccessibilityFinding {
  code: string;
  severity: string;
  message: string;
  evidence: string;
  recommendation: string;
  elements?: AccessibilityElementEvidence[];
}

export interface AccessibilityElementEvidence {
  dom_position: number;
  dom_query: string;
  html_snippet: string;
  line?: number;
  column?: number;
}

export interface AccessibilityAudit {
  document_language?: string;
  landmarks: AccessibilityLandmark[];
  aria_attribute_count: number;
  form_control_count: number;
  unlabeled_form_control_count: number;
  hidden_form_control_count?: number;
  hidden_form_controls?: AccessibilityElementEvidence[];
  anti_spam_text_control_count?: number;
  anti_spam_text_controls?: AccessibilityElementEvidence[];
  findings?: AccessibilityFinding[];
  manual_review_items: string[];
}

export interface KeywordStat {
  keyword: string;
  count: number;
  /** Percentage of normalized body-word tokens; local deterministic calculation. */
  density_percent?: number;
}

export interface ContentStats {
  word_count: number;
  reading_time_minutes: number;
  text_ratio_percent: number;
  top_keywords: KeywordStat[];
  /** Values are absent in audits created before local complexity metrics were added. */
  sentence_count?: number;
  average_words_per_sentence?: number;
  average_characters_per_word?: number;
  complexity_score?: number;
  complexity_label?: 'simple' | 'moderate' | 'complex' | 'unavailable';
  readability_ease_score?: number;
  readability_grade?: number;
  readability_method?: string;
  readability_label?: string;
  /** Normalized text from the audited document body, never raw HTML. */
  body_text?: string;
  /** The local stored text was capped; phrase counts apply to the retained portion. */
  body_text_truncated?: boolean;
}

export interface IndexabilityAssessment {
  /** Deterministic local verdict: indexable, blocked, or uncertain. */
  status: 'indexable' | 'blocked' | 'uncertain';
  reasons: string[];
  meta_robots?: string;
  x_robots_tag?: string;
  canonical?: string;
  canonical_matches_final_url?: boolean;
  canonical_target_checked?: boolean;
  canonical_target_status?: number;
  canonical_target_check_error?: string;
}

export interface PageAuditData {
  url: string;
  final_url: string;
  timestamp: string;
  http_status: number;
  response_time_ms: number;
  redirect_chain: RedirectHop[];
  meta_tags: MetaTags;
  open_graph: OpenGraphData;
  twitter_card: TwitterCardData;
  headings: HeadingsStructure;
  images: ImageData[];
  links: LinksAnalysis;
  security_headers: SecurityHeaders;
  structured_data: StructuredData[];
  technical: TechnicalData;
  health_score: number;
  issues: Issue[];
  content_stats: ContentStats;
  /** Missing on audit records made before the unified indexability assessment. */
  indexability?: IndexabilityAssessment;
  /** Missing on audit records made before static accessibility checks were added. */
  accessibility?: AccessibilityAudit;
  /** Partial local AMP rules; absent on audits saved before this check existed. */
  amp?: AmpAudit;
  /** Native HTTP GET timing only; not browser-render or Core Web Vitals data. */
  http_performance?: HttpPerformanceMeasurement;
  /** Static transport, embedded-resource and cookie checks; absent on older audit snapshots. */
  transport_security?: TransportSecurityAudit;
}

export interface HttpPerformanceMeasurement {
  measured_at: string;
  method: string;
  response_headers_ms: number;
  body_read_ms: number;
  total_request_ms: number;
  decoded_body_bytes: number;
  content_length_header_bytes?: number | null;
  redirect_hops: number;
  scope: string;
}

export interface AmpFinding {
  code: string;
  severity: 'error' | 'warning' | 'info' | string;
  message: string;
  evidence: string;
  recommendation: string;
}

export interface AmpAudit {
  detected: boolean;
  is_amp_document: boolean;
  amphtml_urls: string[];
  canonical_url?: string;
  coverage: string;
  findings: AmpFinding[];
  unchecked: string[];
}

export interface AppConfig {
  theme: 'dark' | 'light' | 'system';
  language: string;
  default_user_agent: string;
  request_timeout_secs: number;
  max_redirects: number;
  verify_ssl: boolean;
  ai_provider: 'openai' | 'claude' | 'gemini';
  ai_model?: string;
  auto_check_updates: boolean;
  auto_install_updates: boolean;
}

export interface SeoProject {
  id: string;
  name: string;
  rootUrl?: string;
  createdAt: string;
  lastOpenedAt: string;
}

export type TabType =
  | 'overview'
  | 'social'
  | 'headings'
  | 'metadata'
  | 'images'
  | 'links'
  | 'security'
  | 'structured'
  | 'amp'
  | 'performance'
  | 'dataforseo'
  | 'keyword-research'
  | 'keyword-clustering'
  | 'core-web-vitals'
  | 'saved-keywords'
  | 'rank-tracking'
  | 'domain-overview'
  | 'backlink-checker'
  | 'site-audit'
  | 'ai-brand-visibility'
  | 'ai-search-prompts'
  | 'mcp-hub'
  | 'search-console'
  | 'seo-tools';

export interface DataForSEOBacklinkSummary {
  target: string;
  total_backlinks: number;
  referring_domains: number;
  referring_main_domains: number;
  rank: number;
  dofollow_backlinks: number | null;
  broken_backlinks: number;
}

export interface DataForSEOSerpItem {
  type: string;
  rank_group: number;
  rank_absolute: number;
  domain: string;
  title: string;
  description: string;
  url: string;
}

export type AiProvider = 'openai' | 'claude' | 'gemini';

export type AiConnectionMethod = 'api_key' | 'local_cli';

export type AiConnectionState = 'unconfigured' | 'testing' | 'connected' | 'error';

export interface AiAccountConfig {
  provider: AiProvider;
  name: string;
  model: string;
  isConnected: boolean;
  status: AiConnectionState;
  statusMessage?: string;
}

export interface UserSubscription {
  tier: 'direct';
}

export interface AiCliStatus {
  provider: AiProvider;
  command: string;
  available: boolean;
  detail: string;
}

// -------------------------------------------------------------
// Keyword Workflows Models
// -------------------------------------------------------------
export type SearchIntent = 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';

export interface KeywordIdea {
  keyword: string;
  search_volume: number;
  cpc: number;
  competition: number; // 0.0 to 1.0
  difficulty: number; // 0 to 100
  intent: SearchIntent;
  trend: number[];
  /** Original API values, keeping missing metrics distinct from provider-reported zeroes. */
  sourceMetrics?: {
    searchVolume: number | null;
    cpc: number | null;
    competitionIndex: number | null;
    intent: string | null;
    monthlySearches: Array<{ year: number | null; month: number | null; searchVolume: number | null }>;
  };
}

export interface SavedKeywordItem {
  id: string;
  keyword: string;
  search_volume: number;
  difficulty: number;
  cpc: number;
  intent: SearchIntent;
  tags: string[];
  addedAt: string;
}

export interface RankHistoryPoint {
  date: string;
  rank: number;
}

export interface TrackedRankItem {
  id: string;
  keyword: string;
  domain: string;
  target_url: string;
  location: string;
  language_code: string;
  current_rank: number | null;
  previous_rank: number | null;
  delta: number | null;
  best_rank: number | null;
  history: RankHistoryPoint[];
  last_checked: string;
}

// -------------------------------------------------------------
// Domain Research Models
// -------------------------------------------------------------
export interface DomainKeywordItem {
  keyword: string;
  position: number | null;
  search_volume: number | null;
  traffic_share: number | null;
  intent: SearchIntent | null;
}

export interface DomainTopPageItem {
  url: string;
  traffic_percentage: number | null;
  keywords_count: number | null;
}

export interface DomainCompetitorItem {
  domain: string;
  common_keywords: number | null;
  average_position: number | null;
}

export interface DomainComparisonRow {
  domain: string;
  organic_traffic: number | null;
  organic_keywords: number | null;
  domain_rank: number | null;
  referring_domains: number | null;
  total_backlinks?: number | null;
  dofollow_ratio?: number | null;
  retrieved_at: string;
  /** Bounded live samples returned by the same comparison request. */
  top_keywords?: DomainKeywordItem[];
  top_pages?: DomainTopPageItem[];
  competitors?: DomainCompetitorItem[];
}

export interface DomainComparisonData {
  target: string;
  rows: DomainComparisonRow[];
  location_code: number;
  language_code: string;
  retrieved_at: string;
  source: 'dataforseo';
}

/**
 * Bounded, project-scoped history of live domain comparison snapshots.
 * Every entry is a factual response captured at its retrieval timestamp;
 * missing domains/metrics remain null instead of being interpolated.
 */
export type DomainComparisonHistory = DomainComparisonData[];

export interface DomainOverviewData {
  domain: string;
  organic_traffic: number | null;
  organic_keywords: number | null;
  domain_rank: number | null;
  referring_domains: number | null;
  total_backlinks?: number | null;
  dofollow_ratio?: number | null;
  top_keywords: DomainKeywordItem[];
  top_pages: DomainTopPageItem[];
  competitors: DomainCompetitorItem[];
}

export interface BacklinkItem {
  source_title: string;
  source_url: string;
  target_url: string;
  anchor_text: string;
  is_dofollow: boolean;
  domain_rank: number;
  first_seen: string;
}

export interface BacklinkAnchorDistribution {
  anchor: string;
  count: number;
  percentage: number | null;
}

export interface BacklinkProfileData {
  domain: string;
  total_backlinks: number;
  referring_domains: number;
  referring_subnets: number | null;
  domain_rank: number;
  dofollow_ratio: number | null;
  total_anchor_rows: number | null;
  total_backlink_rows: number | null;
  anchors: BacklinkAnchorDistribution[];
  backlinks: BacklinkItem[];
}

/** Bounded summary captured after a real backlink-profile request. */
export interface BacklinkProfileSnapshot {
  domain: string;
  retrieved_at: string;
  total_backlinks: number | null;
  referring_domains: number | null;
  domain_rank: number | null;
  dofollow_ratio: number | null;
}

export type BacklinkProfileHistory = BacklinkProfileSnapshot[];

export interface BacklinkGapOpportunity {
  referring_domain: string;
  target_backlinks: number;
  competitor_backlinks: Array<{ domain: string; backlinks: number; rank: number | null }>;
  max_competitor_spam_score: number | null;
}

export interface BacklinkGapReport {
  target: string;
  competitors: string[];
  include_subdomains: boolean;
  opportunities: BacklinkGapOpportunity[];
  total_rows: number | null;
  rows_scanned: number;
}

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

// -------------------------------------------------------------
// AI Visibility & GEO Models
// -------------------------------------------------------------
export interface AiResearchObservation {
  prompt?: string;
  repetition?: number;
  search_mode?: 'web_enabled' | 'model_knowledge';
  mention_position?: number | null;
  own_domain_cited?: boolean;
  competitors_mentioned?: string[];
}

export interface AiModelPresence extends AiResearchObservation {
  model_name: string;
  model_id: string | null;
  is_present: boolean;
  visibility_percentage: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'not_mentioned' | 'not_assessed';
  summary: string;
  cited_sources: string[];
  provider: AiProvider;
  connection_method: 'local_cli';
  captured_at: string;
  response_status: 'success' | 'error';
  error_message?: string;
}

export interface BrandAiVisibilityReport {
  methodology?: 'unbranded_prompts';
  prompts?: string[];
  repetitions?: number;
  competitors?: string[];
  share_of_voice?: number | null;
  brand: string;
  domain: string;
  overall_score: number | null;
  models: AiModelPresence[];
  query_checked: string;
  timestamp: string;
  key_takeaways: string[];
}

export interface AiPromptComparisonResult extends AiResearchObservation {
  model_name: string;
  response_text: string;
  brand_mentions: string[];
  citations: string[];
  provider: AiProvider;
  connection_method: 'local_cli';
  captured_at: string;
  response_status: 'success' | 'error';
  error_message?: string;
}

export interface AiPromptComparison {
  prompt: string;
  captured_at: string;
  results: AiPromptComparisonResult[];
}

// -------------------------------------------------------------
// MCP Server & Search Console Models
// -------------------------------------------------------------
export interface McpToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

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
