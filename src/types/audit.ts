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
