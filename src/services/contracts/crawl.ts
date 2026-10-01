import { z } from 'zod';
import type { CustomSearchDefinition, CrawlConfig, CrawledDiscoverySource, CrawledRedirectHop, CrawledCanonicalTarget, CrawledClientRedirect, CrawledRobotsDecision, CrawledIndexabilityVerdict, CrawledContentTerm, CrawledFocusPhraseEvidence, CrawledLink, CrawledSchemaReference, StructuredDataValidationIssue, CrawledSchemaFinding, CrawledHtmlValidationFinding, CrawledHreflang, CrawledDuplicateHeading, CrawledPaginationLink, CrawledImageResourceCheck, CrawledImage, CrawledFrame, FaviconData, CrawledSocialResourceCheck, CrawledSocialMetaTag, CrawledCustomSearchResult, IssueSeverity, CrawledPageIssue, CrawledPageSummary, CrawledResource, SiteCrawlResult, CrawlRunRecord } from '@/types';

// Runtime boundaries for untrusted native and persisted crawl snapshots.
// Optional native nulls remain null where declared; omitted optional fields stay unavailable.
export const CustomSearchDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  selectorType: z.union([z.literal('css'), z.literal('xpath'), z.literal('regex')]),
  query: z.string(),
  resultType: z.union([z.literal('text'), z.literal('html'), z.literal('attribute')]),
  attribute: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CustomSearchDefinition, z.ZodTypeDef, unknown>;

export const CrawlConfigSchema = z.object({
  crawlMode: z.union([z.literal('http'), z.literal('browser-rendered')]).nullable().transform(value => value ?? undefined).optional(),
  renderWaitForSelector: z.string().nullable().transform(value => value ?? undefined).optional(),
  renderWaitDelayMs: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  renderLazyScrollCycles: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  maxPages: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  maxDepth: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  includePatterns: z.array(z.string()),
  excludePatterns: z.array(z.string()),
  allowSubdomains: z.boolean(),
  allowedHosts: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  scopePath: z.string().nullable().transform(value => value ?? undefined).optional(),
  keepQueryStrings: z.boolean(),
  respectRobots: z.boolean(),
  respectCrawlDelay: z.boolean(),
  discoverSitemaps: z.boolean(),
  maxRedirects: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  followNofollow: z.boolean(),
  maxResponseBytes: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  maxRunSeconds: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  requestTimeoutSecs: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  verifySsl: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  seedUrls: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  listMode: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  userAgent: z.string().nullable().transform(value => value ?? undefined).optional(),
  requestProfileId: z.string().nullable().transform(value => value ?? undefined).optional(),
  trimTrailingSlash: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  lowercasePath: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  stripTrackingParameters: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  allowedQueryParameters: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  deniedQueryParameters: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  customSearches: z.array(CustomSearchDefinitionSchema).nullable().transform(value => value ?? undefined).optional(),
  focusPhrase: z.string().nullable().transform(value => value ?? undefined).optional(),
  crawlImages: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  crawlStylesheets: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  crawlScripts: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  crawlOtherResources: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  maxResourceRequests: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  maxConcurrentRequests: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  resumeCompletedUrls: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  resumeFrontierUrls: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawlConfig, z.ZodTypeDef, unknown>;

export const CrawledDiscoverySourceSchema = z.object({
  kind: z.string(),
  source_url: z.union([z.string(), z.null()]).optional(),
  anchor_text: z.union([z.string(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledDiscoverySource, z.ZodTypeDef, unknown>;

export const CrawledRedirectHopSchema = z.object({
  from_url: z.string(),
  http_status: z.number().finite(),
  to_url: z.string(),
  response_time_ms: z.union([z.number().finite(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledRedirectHop, z.ZodTypeDef, unknown>;

export const CrawledCanonicalTargetSchema = z.object({
  url: z.string(),
  relation: z.string(),
  http_status: z.union([z.number().finite(), z.null()]).optional(),
  checked_in_run: z.boolean(),
}).passthrough() satisfies z.ZodType<CrawledCanonicalTarget, z.ZodTypeDef, unknown>;

export const CrawledClientRedirectSchema = z.object({
  source: z.string(),
  declaration: z.string(),
  delay_seconds: z.union([z.number().finite(), z.null()]).optional(),
  target_url: z.union([z.string(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledClientRedirect, z.ZodTypeDef, unknown>;

export const CrawledRobotsDecisionSchema = z.object({
  indexability: z.string(),
  link_following: z.string(),
  directives: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  sources: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  response_headers_available: z.boolean(),
}).passthrough() satisfies z.ZodType<CrawledRobotsDecision, z.ZodTypeDef, unknown>;

export const CrawledIndexabilityVerdictSchema = z.object({
  status: z.string(),
  reasons: z.array(z.string()),
}).passthrough() satisfies z.ZodType<CrawledIndexabilityVerdict, z.ZodTypeDef, unknown>;

export const CrawledContentTermSchema = z.object({
  term: z.string(),
  count: z.number().finite(),
  density_percent: z.number().finite(),
}).passthrough() satisfies z.ZodType<CrawledContentTerm, z.ZodTypeDef, unknown>;

export const CrawledFocusPhraseEvidenceSchema = z.object({
  phrase: z.string(),
  body_occurrences: z.number().finite(),
  body_density_percent: z.number().finite(),
  title_occurrences: z.number().finite(),
  meta_description_occurrences: z.number().finite(),
  h1_occurrences: z.number().finite(),
}).passthrough() satisfies z.ZodType<CrawledFocusPhraseEvidence, z.ZodTypeDef, unknown>;

export const CrawledLinkSchema = z.object({
  target_url: z.string(),
  anchor_text: z.string(),
  rel: z.string().nullable().transform(value => value ?? undefined).optional(),
  is_internal: z.boolean(),
  source_excerpt: z.string().nullable().transform(value => value ?? undefined).optional(),
  target_http_status: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  target_response_time_ms: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  target_redirect_url: z.string().nullable().transform(value => value ?? undefined).optional(),
  target_request_error_kind: z.string().nullable().transform(value => value ?? undefined).optional(),
  target_checked_at: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledLink, z.ZodTypeDef, unknown>;

export const CrawledSchemaReferenceSchema = z.object({
  format: z.string(),
  declaration_index: z.number().finite(),
  property: z.string(),
  value: z.string(),
}).passthrough() satisfies z.ZodType<CrawledSchemaReference, z.ZodTypeDef, unknown>;

export const StructuredDataValidationIssueSchema = z.object({
  code: z.string(),
  severity: z.union([z.literal('error'), z.literal('warning'), z.literal('info')]),
  message: z.string(),
  path: z.string().nullable().transform(value => value ?? undefined).optional(),
  recommendation: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<StructuredDataValidationIssue, z.ZodTypeDef, unknown>;

export const CrawledSchemaFindingSchema = z.object({
  format: z.string(),
  declaration_index: z.number().finite(),
  finding: StructuredDataValidationIssueSchema,
}).passthrough() satisfies z.ZodType<CrawledSchemaFinding, z.ZodTypeDef, unknown>;

export const CrawledHtmlValidationFindingSchema = z.object({
  code: z.string(),
  severity: z.string(),
  message: z.string(),
  element: z.string().nullable().transform(value => value ?? undefined).optional(),
  attribute: z.string().nullable().transform(value => value ?? undefined).optional(),
  value: z.string().nullable().transform(value => value ?? undefined).optional(),
  line: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  column: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  source_excerpt: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledHtmlValidationFinding, z.ZodTypeDef, unknown>;

export const CrawledHreflangSchema = z.object({
  language: z.string(),
  target_url: z.string(),
  target_http_status: z.union([z.number().finite(), z.null()]).optional(),
  target_checked_in_run: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  reciprocal_in_run: z.union([z.boolean(), z.null()]).optional(),
  target_canonical_alignment: z.union([z.string(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledHreflang, z.ZodTypeDef, unknown>;

export const CrawledDuplicateHeadingSchema = z.object({
  text: z.string(),
  levels: z.array(z.number().finite()),
  occurrences: z.number().finite(),
}).passthrough() satisfies z.ZodType<CrawledDuplicateHeading, z.ZodTypeDef, unknown>;

export const CrawledPaginationLinkSchema = z.object({
  relation: z.string(),
  target_url: z.string(),
  query_parameter_changes: z.array(z.string()),
  http_status: z.union([z.number().finite(), z.null()]).optional(),
  checked_in_run: z.boolean(),
  reciprocal_in_run: z.union([z.boolean(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledPaginationLink, z.ZodTypeDef, unknown>;

export const CrawledImageResourceCheckSchema = z.object({
  url: z.string(),
  checked_in_run: z.boolean(),
  http_status: z.union([z.number().finite(), z.null()]).optional(),
  content_length: z.union([z.number().finite(), z.null()]).optional(),
  request_error_kind: z.union([z.string(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledImageResourceCheck, z.ZodTypeDef, unknown>;

export const CrawledImageSchema = z.object({
  src: z.string(),
  alt: z.string().nullable().transform(value => value ?? undefined).optional(),
  srcset: z.string().nullable().transform(value => value ?? undefined).optional(),
  format: z.string().nullable().transform(value => value ?? undefined).optional(),
  width: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  height: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  dimensions_source: z.string().nullable().transform(value => value ?? undefined).optional(),
  lazy_loaded: z.boolean(),
  checked_in_run: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  http_status: z.union([z.number().finite(), z.null()]).optional(),
  content_length: z.union([z.number().finite(), z.null()]).optional(),
  request_error_kind: z.union([z.string(), z.null()]).optional(),
  srcset_resource_checks: z.array(CrawledImageResourceCheckSchema).nullable().transform(value => value ?? undefined).optional(),
  srcset_resource_checks_truncated: z.boolean().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledImage, z.ZodTypeDef, unknown>;

export const CrawledFrameSchema = z.object({
  src: z.string().nullable().transform(value => value ?? undefined).optional(),
  resolved_url: z.string().nullable().transform(value => value ?? undefined).optional(),
  title: z.string().nullable().transform(value => value ?? undefined).optional(),
  name: z.string().nullable().transform(value => value ?? undefined).optional(),
  loading: z.string().nullable().transform(value => value ?? undefined).optional(),
  sandbox: z.string().nullable().transform(value => value ?? undefined).optional(),
  checked_in_run: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  http_status: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  request_error_kind: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledFrame, z.ZodTypeDef, unknown>;

export const FaviconDataSchema = z.object({
  href: z.string(),
  rel: z.string(),
  declared_type: z.string().nullable().transform(value => value ?? undefined).optional(),
  declared_sizes: z.string().nullable().transform(value => value ?? undefined).optional(),
  inferred_format: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<FaviconData, z.ZodTypeDef, unknown>;

export const CrawledSocialResourceCheckSchema = z.object({
  url: z.string(),
  checked_in_run: z.boolean(),
  http_status: z.union([z.number().finite(), z.null()]).optional(),
  content_type: z.union([z.string(), z.null()]).optional(),
  content_length: z.union([z.number().finite(), z.null()]).optional(),
  intrinsic_width: z.union([z.number().finite(), z.null()]).optional(),
  intrinsic_height: z.union([z.number().finite(), z.null()]).optional(),
  dimensions_source: z.union([z.literal('intrinsic-http'), z.string(), z.null()]).optional(),
  request_error_kind: z.union([z.string(), z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledSocialResourceCheck, z.ZodTypeDef, unknown>;

export const CrawledSocialMetaTagSchema = z.object({
  key: z.string(),
  content: z.union([z.string(), z.null()]).optional(),
  resource_check: z.union([CrawledSocialResourceCheckSchema, z.null()]).optional(),
}).passthrough() satisfies z.ZodType<CrawledSocialMetaTag, z.ZodTypeDef, unknown>;

export const CrawledCustomSearchResultSchema = z.object({
  id: z.string(),
  values: z.array(z.string()),
  error: z.union([z.string(), z.null()]).optional(),
  truncated: z.boolean(),
}).passthrough() satisfies z.ZodType<CrawledCustomSearchResult, z.ZodTypeDef, unknown>;

export const IssueSeveritySchema = z.union([z.literal('Critical'), z.literal('Warning'), z.literal('Info')]) satisfies z.ZodType<IssueSeverity, z.ZodTypeDef, unknown>;

export const CrawledPageIssueSchema = z.object({
  severity: IssueSeveritySchema,
  message: z.string(),
  code: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledPageIssue, z.ZodTypeDef, unknown>;

export const CrawledPageSummarySchema = z.object({
  url: z.string(),
  final_url: z.string(),
  discovery_sources: z.array(CrawledDiscoverySourceSchema).nullable().transform(value => value ?? undefined).optional(),
  redirect_chain: z.array(CrawledRedirectHopSchema),
  redirect_stop_reason: z.union([z.string(), z.null()]).optional(),
  depth: z.number().finite(),
  http_status: z.number().finite(),
  response_time_ms: z.number().finite(),
  rendered_lcp_ms: z.union([z.number().finite(), z.null()]).optional(),
  rendered_inp_ms: z.union([z.number().finite(), z.null()]).optional(),
  rendered_cls: z.union([z.number().finite(), z.null()]).optional(),
  request_error_kind: z.union([z.string(), z.null()]).optional(),
  title: z.union([z.string(), z.null()]).optional(),
  title_length: z.union([z.number().finite(), z.null()]).optional(),
  meta_description: z.union([z.string(), z.null()]).optional(),
  meta_description_length: z.union([z.number().finite(), z.null()]).optional(),
  canonical: z.union([z.string(), z.null()]).optional(),
  canonical_targets: z.array(CrawledCanonicalTargetSchema).nullable().transform(value => value ?? undefined).optional(),
  canonical_declaration_count: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  canonical_relation: z.string().nullable().transform(value => value ?? undefined).optional(),
  canonical_robots_conflict: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  client_redirects: z.array(CrawledClientRedirectSchema).nullable().transform(value => value ?? undefined).optional(),
  meta_robots: z.union([z.string(), z.null()]).optional(),
  x_robots_tag: z.union([z.string(), z.null()]).optional(),
  robots_decision: z.union([CrawledRobotsDecisionSchema, z.null()]).optional(),
  indexability_verdict: z.union([CrawledIndexabilityVerdictSchema, z.null()]).optional(),
  indexability_status: z.string(),
  content_type: z.union([z.string(), z.null()]).optional(),
  content_length: z.union([z.number().finite(), z.null()]).optional(),
  content_encoding: z.union([z.string(), z.null()]).optional(),
  charset: z.union([z.string(), z.null()]).optional(),
  detected_charset: z.union([z.string(), z.null()]).optional(),
  cache_control: z.union([z.string(), z.null()]).optional(),
  body_truncated: z.boolean(),
  word_count: z.number().finite(),
  text_ratio_percent: z.union([z.number().finite(), z.null()]).optional(),
  reading_time_minutes: z.union([z.number().finite(), z.null()]).optional(),
  sentence_count: z.union([z.number().finite(), z.null()]).optional(),
  average_words_per_sentence: z.union([z.number().finite(), z.null()]).optional(),
  average_characters_per_word: z.union([z.number().finite(), z.null()]).optional(),
  complexity_score: z.union([z.number().finite(), z.null()]).optional(),
  complexity_label: z.union([z.string(), z.null()]).optional(),
  readability_ease_score: z.union([z.number().finite(), z.null()]).optional(),
  readability_grade: z.union([z.number().finite(), z.null()]).optional(),
  readability_method: z.union([z.string(), z.null()]).optional(),
  readability_label: z.union([z.string(), z.null()]).optional(),
  content_terms: z.array(CrawledContentTermSchema).nullable().transform(value => value ?? undefined).optional(),
  focus_phrase: z.union([CrawledFocusPhraseEvidenceSchema, z.null()]).optional(),
  content_hash: z.union([z.string(), z.null()]).optional(),
  content_simhash: z.union([z.string(), z.null()]).optional(),
  semantic_terms: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  semantic_excerpts: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  semantic_links: z.array(CrawledLinkSchema).nullable().transform(value => value ?? undefined).optional(),
  semantic_content_source: z.string().nullable().transform(value => value ?? undefined).optional(),
  semantic_content_provenance: z.string().nullable().transform(value => value ?? undefined).optional(),
  semantic_content_partial: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  schema_types: z.array(z.string()),
  schema_references: z.array(CrawledSchemaReferenceSchema).nullable().transform(value => value ?? undefined).optional(),
  schema_syntax_errors: z.number().finite(),
  schema_validation_findings: z.array(CrawledSchemaFindingSchema).nullable().transform(value => value ?? undefined).optional(),
  schema_validation_truncated: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  html_validation_findings: z.array(CrawledHtmlValidationFindingSchema).nullable().transform(value => value ?? undefined).optional(),
  html_validation_truncated: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  document_language: z.union([z.string(), z.null()]).optional(),
  hreflangs: z.array(CrawledHreflangSchema),
  amp_url: z.union([z.string(), z.null()]).optional(),
  amp_target_http_status: z.union([z.number().finite(), z.null()]).optional(),
  amp_target_checked_in_run: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  amp_target_canonical_alignment: z.union([z.literal('canonical-to-source'), z.literal('self-canonical'), z.literal('canonical-points-elsewhere'), z.literal('missing-canonical'), z.null()]).optional(),
  h1_count: z.number().finite(),
  heading_counts: z.array(z.number().finite()).nullable().transform(value => value ?? undefined).optional(),
  duplicate_headings: z.array(CrawledDuplicateHeadingSchema).nullable().transform(value => value ?? undefined).optional(),
  pagination_next: z.union([z.string(), z.null()]).optional(),
  pagination_prev: z.union([z.string(), z.null()]).optional(),
  pagination_links: z.array(CrawledPaginationLinkSchema).nullable().transform(value => value ?? undefined).optional(),
  pagination_declaration_count: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  pagination_invalid_declaration_count: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  pagination_canonical_alignment: z.union([z.string(), z.null()]).optional(),
  internal_link_count: z.number().finite(),
  external_link_count: z.number().finite(),
  links: z.array(CrawledLinkSchema),
  images: z.array(CrawledImageSchema),
  frames: z.array(CrawledFrameSchema).nullable().transform(value => value ?? undefined).optional(),
  frames_truncated: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  favicons: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  favicon_metadata: z.array(FaviconDataSchema).nullable().transform(value => value ?? undefined).optional(),
  favicon_resource_checks: z.array(CrawledSocialResourceCheckSchema).nullable().transform(value => value ?? undefined).optional(),
  social_meta_tags: z.array(CrawledSocialMetaTagSchema).nullable().transform(value => value ?? undefined).optional(),
  custom_search_results: z.array(CrawledCustomSearchResultSchema).nullable().transform(value => value ?? undefined).optional(),
  issues_count: z.number().finite(),
  issues: z.array(CrawledPageIssueSchema),
}).passthrough() satisfies z.ZodType<CrawledPageSummary, z.ZodTypeDef, unknown>;

export const CrawledResourceSchema = z.object({
  source_urls: z.array(z.string()),
  url: z.string(),
  resource_type: z.string(),
  http_status: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  content_type: z.string().nullable().transform(value => value ?? undefined).optional(),
  content_length: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  intrinsic_width: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  intrinsic_height: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  dimensions_source: z.string().nullable().transform(value => value ?? undefined).optional(),
  response_time_ms: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  request_error_kind: z.string().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawledResource, z.ZodTypeDef, unknown>;

export const SiteCrawlResultSchema = z.object({
  start_url: z.string(),
  crawl_mode: z.union([z.literal('http'), z.literal('browser-rendered')]).nullable().transform(value => value ?? undefined).optional(),
  pages_crawled: z.number().finite(),
  health_score: z.number().finite(),
  critical_count: z.number().finite(),
  warning_count: z.number().finite(),
  notice_count: z.number().finite(),
  pages: z.array(CrawledPageSummarySchema),
  duration_ms: z.number().finite(),
  cancelled: z.boolean(),
  timed_out: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  robots_txt_status: z.string(),
  robots_user_agent: z.string().nullable().transform(value => value ?? undefined).optional(),
  robots_applicable_rules: z.array(z.object({
  directive: z.string(),
  path: z.string(),
}).passthrough()).nullable().transform(value => value ?? undefined).optional(),
  robots_agent_matrix: z.array(z.object({
  user_agent: z.string(),
  specific_group: z.boolean(),
  applicable_rules: z.array(z.object({
  directive: z.string(),
  path: z.string(),
}).passthrough()),
  crawl_delay_ms: z.union([z.number().finite(), z.null()]).optional(),
}).passthrough()).nullable().transform(value => value ?? undefined).optional(),
  robots_sitemap_directives: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
  robots_blocked_count: z.number().finite(),
  sitemap_status: z.string(),
  sitemap_urls_discovered: z.number().finite(),
  sitemap_urls: z.array(z.string()),
  rejected_urls: z.array(z.object({
  url: z.string(),
  reason: z.string(),
}).passthrough()).nullable().transform(value => value ?? undefined).optional(),
  resources: z.array(CrawledResourceSchema).nullable().transform(value => value ?? undefined).optional(),
  resource_limit_reached: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  storage_pages_truncated: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  storage_pages_total: z.number().finite().nullable().transform(value => value ?? undefined).optional(),
  discovery_provenance_truncated: z.boolean().nullable().transform(value => value ?? undefined).optional(),
  limit_reasons: z.array(z.string()).nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<SiteCrawlResult, z.ZodTypeDef, unknown>;

export const CrawlRunRecordSchema = z.object({
  id: z.string(),
  completedAt: z.string(),
  startUrl: z.string(),
  config: CrawlConfigSchema,
  result: SiteCrawlResultSchema,
  environment: z.union([z.literal('default'), z.literal('staging'), z.literal('production')]).nullable().transform(value => value ?? undefined).optional(),
  storage_compacted: z.boolean().nullable().transform(value => value ?? undefined).optional(),
}).passthrough() satisfies z.ZodType<CrawlRunRecord, z.ZodTypeDef, unknown>;
