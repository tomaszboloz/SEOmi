import type { CrawledDiscoverySource, CrawledRobotsDecision, CrawledIndexabilityVerdict, CrawledContentTerm, CrawledFocusPhraseEvidence, CrawledSchemaReference, CrawledSchemaFinding, CrawledHtmlValidationFinding, CrawledPageIssue } from './findings';
import type { CrawledRedirectHop, CrawledCanonicalTarget, CrawledClientRedirect, CrawledHreflang, CrawledDuplicateHeading, CrawledPaginationLink } from './navigation';
import type { CrawledLink } from './links';
import type { CrawledImage, CrawledFrame, CrawledSocialResourceCheck, CrawledSocialMetaTag } from './media';
import type { FaviconData } from '../audit/technical';
import type { CrawledCustomSearchResult } from './configuration';

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
