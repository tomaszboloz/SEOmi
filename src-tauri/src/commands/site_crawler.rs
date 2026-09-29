use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, COOKIE, USER_AGENT};
use scraper::{node::Node, ElementRef, Html, Selector};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet, VecDeque};
use std::error::Error;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use tauri::{AppHandle, Emitter, State};
use tokio::task::JoinSet;

use crate::commands::rendered_crawler::{RenderOptions, RenderedCrawlerSession};
use crate::commands::settings::{crawl_auth_profile, CrawlAuthProfile};
use crate::models::audit_data::{FaviconData, StructuredDataValidationIssue};
use crate::services::custom_search::{
    extract_custom_search_results_with_html, validate_custom_searches, CrawledCustomSearchResult,
    CustomSearchDefinition, MAX_CUSTOM_SEARCH_CHARS_PER_RUN,
};
use crate::services::schema_validator;
use crate::utils::url_validator::validate_and_normalize_url;

const MAX_SEMANTIC_CONTENT_LINKS_PER_PAGE: usize = 1_000;
const MAX_SEMANTIC_TERMS_PER_PAGE: usize = 40;
const MAX_SEMANTIC_EXCERPTS_PER_PAGE: usize = 8;
const MAX_SCHEMA_DECLARATIONS_PER_PAGE: usize = 100;
const MAX_SCHEMA_FINDINGS_PER_PAGE: usize = 200;
const MAX_SCHEMA_REFERENCES_PER_PAGE: usize = 64;
const MAX_SCHEMA_REFERENCE_VALUE_CHARS: usize = 2_048;
const MAX_SRCSET_CANDIDATES_PER_IMAGE: usize = 20;
const MAX_RESOURCE_DISCOVERY_CANDIDATES: usize = 10_000;
const MAX_HTML_VALIDATION_FINDINGS_PER_PAGE: usize = 200;
const MAX_IFRAMES_PER_PAGE: usize = 500;
const MAX_INLINE_IMAGE_URI_CHARS: usize = 8_192;
const MAX_ROBOTS_RULES: usize = 100;
/// Resource crawling is opt-in. When enabled, retain only a bounded prefix of
/// an image response for intrinsic-dimension decoding; the response body is
/// never persisted in the crawl snapshot.
const MAX_INTRINSIC_IMAGE_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledPageIssue {
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledSchemaFinding {
    pub format: String,
    pub declaration_index: usize,
    pub finding: StructuredDataValidationIssue,
}

/// A bounded identifier or relationship explicitly present in structured data.
/// Values are retained as declared; the crawler never dereferences or resolves
/// them against an external knowledge graph.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CrawledSchemaReference {
    pub format: String,
    pub declaration_index: usize,
    pub property: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledHtmlValidationFinding {
    pub code: String,
    pub severity: String,
    pub message: String,
    pub element: Option<String>,
    pub attribute: Option<String>,
    pub value: Option<String>,
    #[serde(default)]
    pub line: Option<usize>,
    #[serde(default)]
    pub column: Option<usize>,
    #[serde(default)]
    pub source_excerpt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CrawledDuplicateHeading {
    pub text: String,
    pub levels: Vec<usize>,
    pub occurrences: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledLink {
    pub target_url: String,
    pub anchor_text: String,
    pub rel: Option<String>,
    pub is_internal: bool,
    /// Bounded source element excerpt for locating the link in the fetched HTML.
    /// Sensitive form values and inline event handlers are redacted before storage.
    #[serde(default)]
    pub source_excerpt: Option<String>,
    pub target_http_status: Option<u16>,
    #[serde(default)]
    pub target_response_time_ms: Option<u64>,
    #[serde(default)]
    pub target_redirect_url: Option<String>,
    #[serde(default)]
    pub target_request_error_kind: Option<String>,
    #[serde(default)]
    pub target_checked_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledImage {
    pub src: String,
    pub alt: Option<String>,
    pub srcset: Option<String>,
    pub format: Option<String>,
    pub width: Option<usize>,
    pub height: Option<usize>,
    /// Explains whether dimensions came from HTML attributes or bounded local
    /// decoding of an embedded data URI. Missing means unknown/legacy data.
    #[serde(default)]
    pub dimensions_source: Option<String>,
    pub lazy_loaded: bool,
    /// True only when this crawl run actually requested and received a resource result.
    #[serde(default)]
    pub checked_in_run: bool,
    #[serde(default)]
    pub http_status: Option<u16>,
    #[serde(default)]
    pub content_length: Option<u64>,
    #[serde(default)]
    pub request_error_kind: Option<String>,
    #[serde(default)]
    pub srcset_resource_checks: Vec<CrawledImageResourceCheck>,
    #[serde(default)]
    pub srcset_resource_checks_truncated: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledImageResourceCheck {
    pub url: String,
    #[serde(default)]
    pub checked_in_run: bool,
    #[serde(default)]
    pub http_status: Option<u16>,
    #[serde(default)]
    pub content_length: Option<u64>,
    #[serde(default)]
    pub request_error_kind: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledFrame {
    pub src: Option<String>,
    pub resolved_url: Option<String>,
    pub title: Option<String>,
    pub name: Option<String>,
    pub loading: Option<String>,
    pub sandbox: Option<String>,
    #[serde(default)]
    pub checked_in_run: bool,
    #[serde(default)]
    pub http_status: Option<u16>,
    #[serde(default)]
    pub request_error_kind: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CrawledSocialMetaTag {
    pub key: String,
    pub content: Option<String>,
    #[serde(default)]
    pub resource_check: Option<CrawledSocialResourceCheck>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CrawledSocialResourceCheck {
    pub url: String,
    #[serde(default)]
    pub checked_in_run: bool,
    #[serde(default)]
    pub http_status: Option<u16>,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub content_length: Option<u64>,
    #[serde(default)]
    pub intrinsic_width: Option<usize>,
    #[serde(default)]
    pub intrinsic_height: Option<usize>,
    #[serde(default)]
    pub dimensions_source: Option<String>,
    #[serde(default)]
    pub request_error_kind: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledCanonicalTarget {
    pub url: String,
    pub relation: String,
    pub http_status: Option<u16>,
    pub checked_in_run: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledResource {
    pub source_urls: Vec<String>,
    pub url: String,
    pub resource_type: String,
    pub http_status: Option<u16>,
    pub content_type: Option<String>,
    pub content_length: Option<u64>,
    /// Dimensions decoded from a bounded prefix of an image body. These are
    /// optional because non-image resources, truncated/unsupported formats,
    /// and failed requests must remain explicitly unknown.
    #[serde(default)]
    pub intrinsic_width: Option<usize>,
    #[serde(default)]
    pub intrinsic_height: Option<usize>,
    #[serde(default)]
    pub dimensions_source: Option<String>,
    /// Wall-clock duration until response headers (or request error) are received.
    /// This is native HTTP timing, not browser resource timing or Core Web Vitals.
    #[serde(default)]
    pub response_time_ms: Option<u64>,
    pub request_error_kind: Option<String>,
}

#[derive(Debug, Clone)]
struct ResourceCandidate {
    source_urls: Vec<String>,
    url: String,
    resource_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledRedirectHop {
    pub from_url: String,
    pub http_status: u16,
    pub to_url: String,
    /// Time spent waiting for this redirect response. Absent in legacy runs.
    #[serde(default)]
    pub response_time_ms: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CrawledHreflang {
    pub language: String,
    pub target_url: String,
    #[serde(default)]
    pub target_http_status: Option<u16>,
    #[serde(default)]
    pub target_checked_in_run: bool,
    #[serde(default)]
    pub reciprocal_in_run: Option<bool>,
    #[serde(default)]
    pub target_canonical_alignment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CrawledContentTerm {
    pub term: String,
    pub count: usize,
    pub density_percent: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct CrawledFocusPhraseEvidence {
    pub phrase: String,
    pub body_occurrences: usize,
    pub body_density_percent: f64,
    pub title_occurrences: usize,
    pub meta_description_occurrences: usize,
    pub h1_occurrences: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledPageSummary {
    pub url: String,
    pub final_url: String,
    /// Bounded provenance explaining how this URL entered the crawl queue.
    #[serde(default)]
    pub discovery_sources: Vec<CrawledDiscoverySource>,
    pub redirect_chain: Vec<CrawledRedirectHop>,
    /// Why redirect traversal stopped, when it did not end at a final
    /// non-redirect response. Legacy snapshots may not contain this field.
    #[serde(default)]
    pub redirect_stop_reason: Option<String>,
    pub depth: usize,
    pub http_status: u16,
    /// HTTP request duration in HTTP mode; browser Navigation Timing in rendered mode.
    pub response_time_ms: u64,
    /// Optional lab observations from the rendered browser context. These are
    /// absent for HTTP runs and are never presented as field/CrUX data.
    #[serde(default)]
    pub rendered_lcp_ms: Option<u64>,
    #[serde(default)]
    pub rendered_inp_ms: Option<u64>,
    #[serde(default)]
    pub rendered_cls: Option<f64>,
    pub request_error_kind: Option<String>,
    pub title: Option<String>,
    pub title_length: Option<usize>,
    pub meta_description: Option<String>,
    pub meta_description_length: Option<usize>,
    pub canonical: Option<String>,
    #[serde(default)]
    pub canonical_targets: Vec<CrawledCanonicalTarget>,
    #[serde(default)]
    pub canonical_declaration_count: usize,
    #[serde(default)]
    pub canonical_relation: String,
    #[serde(default)]
    pub canonical_robots_conflict: bool,
    #[serde(default)]
    pub client_redirects: Vec<CrawledClientRedirect>,
    pub meta_robots: Option<String>,
    pub x_robots_tag: Option<String>,
    #[serde(default)]
    pub robots_decision: Option<CrawledRobotsDecision>,
    #[serde(default)]
    pub indexability_verdict: Option<CrawledIndexabilityVerdict>,
    pub indexability_status: String,
    pub content_type: Option<String>,
    pub content_length: Option<u64>,
    pub content_encoding: Option<String>,
    pub charset: Option<String>,
    #[serde(default)]
    pub detected_charset: Option<String>,
    pub cache_control: Option<String>,
    pub body_truncated: bool,
    pub word_count: usize,
    pub text_ratio_percent: Option<f64>,
    pub reading_time_minutes: Option<usize>,
    /// Local, language-agnostic content indicators; not a standard readability score.
    #[serde(default)]
    pub sentence_count: Option<usize>,
    #[serde(default)]
    pub average_words_per_sentence: Option<f64>,
    #[serde(default)]
    pub average_characters_per_word: Option<f64>,
    #[serde(default)]
    pub complexity_score: Option<u8>,
    #[serde(default)]
    pub complexity_label: Option<String>,
    /// Deterministic readability heuristic selected from the document language.
    #[serde(default)]
    pub readability_ease_score: Option<f64>,
    #[serde(default)]
    pub readability_grade: Option<f64>,
    /// Formula identifier (`flesch-en`, `flesch-pl`, or `flesch-like`).
    #[serde(default)]
    pub readability_method: Option<String>,
    #[serde(default)]
    pub readability_label: Option<String>,
    /// Bounded top terms from the main content region; raw page text is never persisted.
    #[serde(default)]
    pub content_terms: Vec<CrawledContentTerm>,
    #[serde(default)]
    pub focus_phrase: Option<CrawledFocusPhraseEvidence>,
    pub content_hash: Option<String>,
    /// A local, non-reversible 64-bit text fingerprint for near-duplicate detection.
    pub content_simhash: Option<String>,
    /// Bounded, local-only terms extracted from the main content region (not site chrome).
    #[serde(default)]
    pub semantic_terms: Vec<String>,
    /// Bounded text fragments from semantic content, used only for local source-context checks.
    /// Raw HTML and full page text are never persisted here.
    #[serde(default)]
    pub semantic_excerpts: Vec<String>,
    /// Internal hyperlinks found inside the main content region only.
    #[serde(default)]
    pub semantic_links: Vec<CrawledLink>,
    /// Provenance of the semantic extraction region. This distinguishes an
    /// explicit main/article root from the conservative body fallback and
    /// keeps failed/non-HTML pages out of the semantic graph.
    #[serde(default = "default_semantic_content_source")]
    pub semantic_content_source: String,
    /// Transport/rendering provenance for the semantic snapshot. `rendered`
    /// means the terms and links came from the post-JavaScript DOM captured by
    /// the isolated browser, not the original HTTP response body.
    #[serde(default = "default_semantic_content_provenance")]
    pub semantic_content_provenance: String,
    /// True when the semantic evidence was bounded or the source was
    /// incomplete. A partial result is never treated as a complete absence of
    /// terms or links by downstream semantic audits.
    #[serde(default)]
    pub semantic_content_partial: bool,
    pub schema_types: Vec<String>,
    /// Bounded identifiers/relationships explicitly declared by structured data.
    #[serde(default)]
    pub schema_references: Vec<CrawledSchemaReference>,
    pub schema_syntax_errors: usize,
    #[serde(default)]
    pub schema_validation_findings: Vec<CrawledSchemaFinding>,
    #[serde(default)]
    pub schema_validation_truncated: bool,
    #[serde(default)]
    pub html_validation_findings: Vec<CrawledHtmlValidationFinding>,
    #[serde(default)]
    pub html_validation_truncated: bool,
    pub document_language: Option<String>,
    pub hreflangs: Vec<CrawledHreflang>,
    pub amp_url: Option<String>,
    #[serde(default)]
    pub amp_target_http_status: Option<u16>,
    #[serde(default)]
    pub amp_target_checked_in_run: bool,
    /// Canonical relationship of an AMP alternate that was also crawled in this run.
    /// Values are bounded tokens: canonical-to-source, self-canonical,
    /// canonical-points-elsewhere, or missing-canonical.
    #[serde(default)]
    pub amp_target_canonical_alignment: Option<String>,
    pub h1_count: usize,
    pub heading_counts: Vec<usize>,
    #[serde(default)]
    pub duplicate_headings: Vec<CrawledDuplicateHeading>,
    pub pagination_next: Option<String>,
    pub pagination_prev: Option<String>,
    #[serde(default)]
    pub pagination_links: Vec<CrawledPaginationLink>,
    #[serde(default)]
    pub pagination_declaration_count: usize,
    #[serde(default)]
    pub pagination_invalid_declaration_count: usize,
    #[serde(default)]
    pub pagination_canonical_alignment: Option<String>,
    pub internal_link_count: usize,
    pub external_link_count: usize,
    pub links: Vec<CrawledLink>,
    pub images: Vec<CrawledImage>,
    #[serde(default)]
    pub frames: Vec<CrawledFrame>,
    #[serde(default)]
    pub frames_truncated: bool,
    #[serde(default)]
    pub favicons: Vec<String>,
    /// Bounded declarations for each favicon URL. The legacy `favicons` URL
    /// list is retained so older snapshots and exports remain readable.
    #[serde(default)]
    pub favicon_metadata: Vec<FaviconData>,
    #[serde(default)]
    pub favicon_resource_checks: Vec<CrawledSocialResourceCheck>,
    #[serde(default)]
    pub social_meta_tags: Vec<CrawledSocialMetaTag>,
    #[serde(default)]
    pub custom_search_results: Vec<CrawledCustomSearchResult>,
    pub issues_count: usize,
    pub issues: Vec<CrawledPageIssue>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledClientRedirect {
    pub source: String,
    pub declaration: String,
    pub delay_seconds: Option<f64>,
    pub target_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledPaginationLink {
    pub relation: String,
    pub target_url: String,
    pub query_parameter_changes: Vec<String>,
    pub http_status: Option<u16>,
    pub checked_in_run: bool,
    /// Whether the target page in this crawl links back with the opposite
    /// pagination relation. `None` means the target was not in this run.
    #[serde(default)]
    pub reciprocal_in_run: Option<bool>,
}

/// Bounded robots.txt view for common crawler identities.  This is derived
/// solely from the robots.txt response already fetched for the crawl; it does
/// not perform a request per bot and never claims that a remote crawler will
/// interpret non-standard directives identically.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledRobotsAgent {
    pub user_agent: String,
    pub specific_group: bool,
    pub applicable_rules: Vec<CrawledRobotsRule>,
    pub crawl_delay_ms: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SiteCrawlResult {
    pub start_url: String,
    /// Result provenance. `http` uses the bounded HTTP transport; `browser-rendered`
    /// captures the DOM from the isolated desktop WebView after JavaScript runs.
    #[serde(default = "default_http_crawl_mode")]
    pub crawl_mode: String,
    pub pages_crawled: usize,
    pub health_score: u8,
    pub critical_count: usize,
    pub warning_count: usize,
    pub notice_count: usize,
    pub pages: Vec<CrawledPageSummary>,
    pub duration_ms: u64,
    pub cancelled: bool,
    pub timed_out: bool,
    pub robots_txt_status: String,
    #[serde(default)]
    pub robots_user_agent: String,
    #[serde(default)]
    pub robots_applicable_rules: Vec<CrawledRobotsRule>,
    #[serde(default)]
    pub robots_agent_matrix: Vec<CrawledRobotsAgent>,
    #[serde(default)]
    pub robots_sitemap_directives: Vec<String>,
    pub robots_blocked_count: usize,
    pub sitemap_status: String,
    pub sitemap_urls_discovered: usize,
    pub sitemap_urls: Vec<String>,
    pub rejected_urls: Vec<RejectedCrawlUrl>,
    pub resources: Vec<CrawledResource>,
    pub resource_limit_reached: bool,
    /// True when a discovery source or target was dropped at the bounded
    /// provenance cap. Consumers must not interpret an empty source list as
    /// proof that no source existed when this flag is set.
    #[serde(default)]
    pub discovery_provenance_truncated: bool,
    /// Machine-readable reasons why the bounded crawl stopped or omitted
    /// evidence. An empty list means no configured cap was observed.
    #[serde(default)]
    pub limit_reasons: Vec<String>,
}

fn default_http_crawl_mode() -> String {
    "http".into()
}

fn default_semantic_content_source() -> String {
    "unavailable".into()
}

fn default_semantic_content_provenance() -> String {
    "unavailable".into()
}

fn semantic_provenance_for_mode(crawl_mode: &str, content_source: &str) -> String {
    if content_source == "unavailable" {
        "unavailable".into()
    } else if crawl_mode == "browser-rendered" {
        "rendered".into()
    } else {
        "http".into()
    }
}

fn semantic_content_is_partial(
    body_truncated: bool,
    body_read_failed: bool,
    term_count: usize,
    excerpt_count: usize,
    link_count: usize,
) -> bool {
    body_truncated
        || body_read_failed
        || term_count >= MAX_SEMANTIC_TERMS_PER_PAGE
        || excerpt_count >= MAX_SEMANTIC_EXCERPTS_PER_PAGE
        || link_count >= MAX_SEMANTIC_CONTENT_LINKS_PER_PAGE
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledRobotsRule {
    pub directive: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RejectedCrawlUrl {
    pub url: String,
    pub reason: String,
}

/// Evidence explaining how a URL entered the crawl queue. A URL can have
/// several sources (for example the start URL and a sitemap), so the crawl
/// keeps a bounded list instead of collapsing provenance to one guess.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CrawledDiscoverySource {
    /// Stable local category: start, seed, sitemap, or link.
    pub kind: String,
    /// URL that supplied the discovery, when one exists.
    #[serde(default)]
    pub source_url: Option<String>,
    /// Anchor text for link discoveries, when available.
    #[serde(default)]
    pub anchor_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CrawledRobotsDecision {
    /// Effective indexing directive after combining declarations.
    pub indexability: String,
    /// Effective link-following directive after combining declarations.
    pub link_following: String,
    /// Recognized tokens in declaration order, without user-agent prefixes.
    #[serde(default)]
    pub directives: Vec<String>,
    /// Declaration sources that were available in this run.
    #[serde(default)]
    pub sources: Vec<String>,
    /// X-Robots-Tag was available only for HTTP responses, not rendered DOM.
    pub response_headers_available: bool,
}

/// Machine-readable crawl verdict combining transport, robots and canonical
/// signals. The existing `indexability_status` remains the human summary for
/// backwards compatibility; consumers should use this object for filtering.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CrawledIndexabilityVerdict {
    pub status: String,
    #[serde(default)]
    pub reasons: Vec<String>,
}

const MAX_DISCOVERY_SOURCES_PER_PAGE: usize = 16;
const MAX_DISCOVERY_TARGETS_PER_RUN: usize = 20_000;

fn record_discovery_source(
    sources_by_url: &mut HashMap<String, Vec<CrawledDiscoverySource>>,
    target_url: &str,
    source: CrawledDiscoverySource,
) -> bool {
    if !sources_by_url.contains_key(target_url)
        && sources_by_url.len() >= MAX_DISCOVERY_TARGETS_PER_RUN
    {
        return false;
    }
    let sources = sources_by_url.entry(target_url.to_owned()).or_default();
    if sources.iter().any(|candidate| candidate == &source) {
        return true;
    }
    if sources.len() < MAX_DISCOVERY_SOURCES_PER_PAGE {
        sources.push(source);
        true
    } else {
        false
    }
}

fn robots_directive_tokens(value: Option<&str>) -> Vec<String> {
    value
        .into_iter()
        .flat_map(|raw| raw.split([',', ';']))
        .flat_map(|part| {
            let part = part.trim().to_ascii_lowercase();
            let part = part
                .rsplit_once(':')
                .map(|(_, directives)| directives)
                .unwrap_or(part.as_str());
            part.split_ascii_whitespace()
                .map(|token| {
                    token
                        .trim_matches(|character: char| {
                            !character.is_ascii_alphanumeric() && character != '-'
                        })
                        .to_owned()
                })
                .filter(|token| {
                    matches!(
                        token.as_str(),
                        "all" | "index" | "noindex" | "follow" | "nofollow" | "none"
                    )
                })
                .collect::<Vec<_>>()
        })
        .collect()
}

fn build_robots_decision(
    meta_robots: Option<&str>,
    x_robots_tag: Option<&str>,
    response_headers_available: bool,
) -> CrawledRobotsDecision {
    let mut directives = robots_directive_tokens(meta_robots);
    directives.extend(robots_directive_tokens(x_robots_tag));
    let mut sources = Vec::new();
    if meta_robots.is_some() {
        sources.push("meta robots".into());
    }
    if x_robots_tag.is_some() {
        sources.push("X-Robots-Tag".into());
    }
    let noindex = directives
        .iter()
        .any(|directive| directive == "noindex" || directive == "none");
    let nofollow = directives
        .iter()
        .any(|directive| directive == "nofollow" || directive == "none");
    CrawledRobotsDecision {
        indexability: if noindex { "noindex" } else { "index" }.into(),
        link_following: if nofollow { "nofollow" } else { "follow" }.into(),
        directives,
        sources,
        response_headers_available,
    }
}

fn build_indexability_verdict(
    status: u16,
    crawl_mode: &str,
    meta_noindex: bool,
    header_noindex: bool,
    canonical_points_elsewhere: bool,
    meta_nofollow: bool,
    header_nofollow: bool,
) -> CrawledIndexabilityVerdict {
    let mut reasons = Vec::new();
    if status >= 400 {
        reasons.push("http_error".into());
    }
    if meta_noindex || header_noindex {
        reasons.push("robots_noindex".into());
    }
    if canonical_points_elsewhere {
        reasons.push("canonical_points_elsewhere".into());
    }
    if meta_nofollow || header_nofollow {
        reasons.push("robots_nofollow".into());
    }
    if status >= 300 {
        reasons.push("redirect_response".into());
    }
    if status == 0 && crawl_mode == "browser-rendered" {
        reasons.push("http_status_unavailable".into());
    }
    if crawl_mode == "browser-rendered" {
        reasons.push("x_robots_header_unavailable".into());
    }
    let status = if status >= 400 || meta_noindex || header_noindex {
        "blocked"
    } else if status == 0
        || canonical_points_elsewhere
        || status >= 300
        || crawl_mode == "browser-rendered"
    {
        "uncertain"
    } else {
        "indexable"
    };
    CrawledIndexabilityVerdict {
        status: status.into(),
        reasons,
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CrawlConfig {
    #[serde(default = "default_http_crawl_mode")]
    pub crawl_mode: String,
    #[serde(default)]
    pub render_wait_for_selector: Option<String>,
    #[serde(default)]
    pub render_wait_delay_ms: Option<u64>,
    #[serde(default)]
    pub render_lazy_scroll_cycles: Option<usize>,
    pub max_pages: Option<usize>,
    pub max_depth: Option<usize>,
    #[serde(default)]
    pub include_patterns: Vec<String>,
    #[serde(default)]
    pub exclude_patterns: Vec<String>,
    #[serde(default)]
    pub allow_subdomains: bool,
    #[serde(default)]
    pub allowed_hosts: Vec<String>,
    pub scope_path: Option<String>,
    #[serde(default)]
    pub keep_query_strings: bool,
    #[serde(default = "default_respect_robots")]
    pub respect_robots: bool,
    #[serde(default = "default_respect_crawl_delay")]
    pub respect_crawl_delay: bool,
    #[serde(default = "default_discover_sitemaps")]
    pub discover_sitemaps: bool,
    pub max_redirects: Option<usize>,
    #[serde(default)]
    pub follow_nofollow: bool,
    pub max_response_bytes: Option<usize>,
    pub max_run_seconds: Option<u64>,
    #[serde(default)]
    pub request_timeout_secs: Option<u64>,
    #[serde(default = "default_verify_ssl")]
    pub verify_ssl: bool,
    #[serde(default)]
    pub seed_urls: Vec<String>,
    #[serde(default)]
    pub list_mode: bool,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub request_profile_id: Option<String>,
    #[serde(default)]
    pub trim_trailing_slash: bool,
    #[serde(default)]
    pub lowercase_path: bool,
    #[serde(default)]
    pub strip_tracking_parameters: bool,
    #[serde(default)]
    pub allowed_query_parameters: Vec<String>,
    #[serde(default)]
    pub denied_query_parameters: Vec<String>,
    #[serde(default)]
    pub custom_searches: Vec<CustomSearchDefinition>,
    /// Optional normalized phrase used only for per-page evidence; no ranking is inferred.
    #[serde(default)]
    pub focus_phrase: Option<String>,
    #[serde(default)]
    pub crawl_images: bool,
    #[serde(default)]
    pub crawl_stylesheets: bool,
    #[serde(default)]
    pub crawl_scripts: bool,
    #[serde(default)]
    pub crawl_other_resources: bool,
    pub max_resource_requests: Option<usize>,
    pub max_concurrent_requests: Option<usize>,
    /// Normalized URLs already completed by an earlier partial run.
    #[serde(default)]
    pub resume_completed_urls: Vec<String>,
    /// Bounded frontier captured from the partial run.
    #[serde(default)]
    pub resume_frontier_urls: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CrawlFilterValidationError {
    pub filter: String,
    pub pattern: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CrawlFilterPreview {
    pub url: String,
    pub included: bool,
    pub reason: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CrawlFilterValidationResult {
    pub valid: bool,
    pub errors: Vec<CrawlFilterValidationError>,
    pub previews: Vec<CrawlFilterPreview>,
}

fn default_respect_robots() -> bool {
    true
}

fn default_verify_ssl() -> bool {
    true
}
fn default_respect_crawl_delay() -> bool {
    true
}
fn default_discover_sitemaps() -> bool {
    true
}

#[derive(Debug, Clone)]
struct RobotsRule {
    allow: bool,
    path: String,
}

struct FetchedResponse {
    response: FetchedPageBody,
    final_url: String,
    redirect_chain: Vec<CrawledRedirectHop>,
    redirect_stopped_reason: Option<String>,
}

enum FetchedPageBody {
    Http(reqwest::Response),
    Rendered(crate::commands::rendered_crawler::RenderedPageSnapshot),
    // Body already read inside the prefetch task. Holding an unread
    // `reqwest::Response` in the prefetch map lets the client's whole-request
    // timeout expire before the sequential loop reaches it.
    Prefetched(Box<FetchedPageData>),
}

struct CrawlFetchFailure {
    kind: String,
    message: String,
}

struct FetchedPageData {
    status: u16,
    content_type: Option<String>,
    content_length: Option<u64>,
    content_encoding: Option<String>,
    http_refresh: Option<String>,
    cache_control: Option<String>,
    charset: Option<String>,
    x_robots_tag: Option<String>,
    declared_html: bool,
    body_truncated: bool,
    body_read_failed: bool,
    body: Vec<u8>,
    rendered_diagnostics: Option<(Vec<String>, Vec<String>)>,
    browser_navigation_time_ms: Option<u64>,
    rendered_lcp_ms: Option<u64>,
    rendered_inp_ms: Option<u64>,
    rendered_cls: Option<f64>,
}

async fn read_fetched_page_data(
    source: FetchedPageBody,
    max_response_bytes: usize,
) -> FetchedPageData {
    match source {
        FetchedPageBody::Prefetched(data) => *data,
        FetchedPageBody::Http(mut response) => {
            let status = response.status().as_u16();
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let content_length = response.content_length();
            let content_encoding = response
                .headers()
                .get(reqwest::header::CONTENT_ENCODING)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let http_refresh = response
                .headers()
                .get("refresh")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned);
            let cache_control = response
                .headers()
                .get(reqwest::header::CACHE_CONTROL)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let charset = content_type.as_deref().and_then(|value| {
                value.split(';').find_map(|part| {
                    let (name, value) = part.trim().split_once('=')?;
                    name.trim()
                        .eq_ignore_ascii_case("charset")
                        .then(|| value.trim().to_string())
                })
            });
            let x_robots_tag = response
                .headers()
                .get("x-robots-tag")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned);
            let declared_html = content_type
                .as_deref()
                .map(|value| value.to_ascii_lowercase().contains("text/html"))
                .unwrap_or(true);
            let mut body_truncated =
                content_length.is_some_and(|size| size > max_response_bytes as u64);
            let mut body_read_failed = false;
            let mut body = Vec::new();
            if !body_truncated {
                loop {
                    match response.chunk().await {
                        Ok(Some(chunk)) => {
                            if body.len().saturating_add(chunk.len()) > max_response_bytes {
                                body_truncated = true;
                                break;
                            }
                            body.extend_from_slice(&chunk);
                        }
                        Ok(None) => break,
                        Err(_) => {
                            body_read_failed = true;
                            break;
                        }
                    }
                }
            }
            FetchedPageData {
                status,
                content_type,
                content_length,
                content_encoding,
                http_refresh,
                cache_control,
                charset,
                x_robots_tag,
                declared_html,
                body_truncated,
                body_read_failed,
                body,
                rendered_diagnostics: None,
                browser_navigation_time_ms: None,
                rendered_lcp_ms: None,
                rendered_inp_ms: None,
                rendered_cls: None,
            }
        }
        FetchedPageBody::Rendered(snapshot) => {
            let mut body = snapshot.html.into_bytes();
            let body_truncated = snapshot.html_truncated || body.len() > max_response_bytes;
            body.truncate(max_response_bytes);
            let content_type = Some(snapshot.content_type);
            let declared_html = content_type
                .as_deref()
                .is_some_and(|value| value.to_ascii_lowercase().contains("html"));
            FetchedPageData {
                status: snapshot.http_status.unwrap_or(0),
                content_type,
                // A serialized DOM length is not the transferred response size.
                content_length: None,
                content_encoding: None,
                http_refresh: None,
                cache_control: None,
                charset: Some(snapshot.charset),
                x_robots_tag: None,
                declared_html,
                body_truncated,
                body_read_failed: false,
                body,
                rendered_diagnostics: Some((
                    snapshot.failed_resource_urls,
                    snapshot.console_errors,
                )),
                browser_navigation_time_ms: snapshot.navigation_time_ms,
                rendered_lcp_ms: snapshot.lcp_ms,
                rendered_inp_ms: snapshot.inp_ms,
                rendered_cls: snapshot.cls,
            }
        }
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CrawlProgress {
    pub run_id: String,
    pub current_url: Option<String>,
    pub discovered: usize,
    pub completed: usize,
    pub queued: usize,
    pub cancelled: bool,
    pub paused: bool,
    pub elapsed_ms: u64,
    pub pages_per_second: f64,
}

#[derive(Default)]
pub struct CrawlControl {
    cancelled_runs: Mutex<HashSet<String>>,
    paused_runs: Mutex<HashSet<String>>,
}

impl CrawlControl {
    pub fn new() -> Self {
        Self {
            cancelled_runs: Mutex::new(HashSet::new()),
            paused_runs: Mutex::new(HashSet::new()),
        }
    }

    fn is_cancelled(&self, run_id: &str) -> bool {
        self.cancelled_runs
            .lock()
            .map(|runs| runs.contains(run_id))
            .unwrap_or(true)
    }

    fn start(&self, run_id: &str) {
        if let Ok(mut runs) = self.cancelled_runs.lock() {
            runs.remove(run_id);
        }
        if let Ok(mut runs) = self.paused_runs.lock() {
            runs.remove(run_id);
        }
    }

    fn pause(&self, run_id: &str) {
        if let Ok(mut runs) = self.paused_runs.lock() {
            runs.insert(run_id.to_string());
        }
    }

    fn resume(&self, run_id: &str) {
        if let Ok(mut runs) = self.paused_runs.lock() {
            runs.remove(run_id);
        }
    }

    fn is_paused(&self, run_id: &str) -> bool {
        self.paused_runs
            .lock()
            .map(|runs| runs.contains(run_id))
            .unwrap_or(false)
    }

    async fn wait_until_resumed(&self, run_id: &str) -> bool {
        while self.is_paused(run_id) && !self.is_cancelled(run_id) {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        !self.is_cancelled(run_id)
    }

    fn finish(&self, run_id: &str) {
        if let Ok(mut runs) = self.paused_runs.lock() {
            runs.remove(run_id);
        }
        if let Ok(mut runs) = self.cancelled_runs.lock() {
            runs.remove(run_id);
        }
    }
}

async fn wait_for_crawl_cancellation(control: &CrawlControl, run_id: &str) {
    while !control.is_cancelled(run_id) {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
}

fn normalize_scope_path(path: Option<&str>) -> Option<String> {
    let path = path?.trim();
    if path.is_empty() || path == "/" {
        return None;
    }
    let normalized = format!("/{}", path.trim_matches('/'));
    Some(normalized)
}

fn normalize_allowed_hosts(values: &[String]) -> Result<Vec<String>, String> {
    let mut normalized = Vec::new();
    for raw in values {
        let candidate = raw.trim();
        if candidate.is_empty() {
            continue;
        }
        let parsed = if candidate.contains("://") {
            url::Url::parse(candidate)
        } else {
            url::Url::parse(&format!("https://{candidate}"))
        }
        .map_err(|_| format!("Invalid allowed host `{candidate}`"))?;
        if parsed.path() != "/"
            || parsed.query().is_some()
            || parsed.fragment().is_some()
            || !parsed.username().is_empty()
            || parsed.password().is_some()
            || parsed.port().is_some()
        {
            return Err(format!(
                "Allowed host must contain only a hostname: `{candidate}`"
            ));
        }
        let host = parsed
            .host_str()
            .ok_or_else(|| format!("Allowed host has no hostname: `{candidate}`"))?
            .trim_end_matches('.')
            .to_ascii_lowercase();
        if host.is_empty() || !normalized.iter().any(|item| item == &host) {
            normalized.push(host);
        }
    }
    Ok(normalized)
}

fn host_matches_root(host: &str, root: &str, allow_subdomains: bool) -> bool {
    host.eq_ignore_ascii_case(root)
        || (allow_subdomains
            && host
                .to_ascii_lowercase()
                .ends_with(&format!(".{}", root.to_ascii_lowercase())))
}

fn matches_scope(
    url: &url::Url,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
    allowed_hosts: &[String],
) -> bool {
    let Some(host) = url.host_str() else {
        return false;
    };
    let is_base_host = host_matches_root(host, base_host, allow_subdomains);
    let is_allowed_host = allowed_hosts
        .iter()
        .any(|allowed| host_matches_root(host, allowed, allow_subdomains));
    if !is_base_host && !is_allowed_host {
        return false;
    }
    // A path scope belongs to the seed host. Explicitly allowlisted hosts are
    // already opt-in and must not accidentally inherit the seed's directory.
    if !is_base_host {
        return true;
    }
    let Some(scope_path) = normalize_scope_path(scope_path) else {
        return true;
    };
    let page_path = url.path();
    page_path == scope_path || page_path.starts_with(&format!("{scope_path}/"))
}

fn matches_filters(url: &str, include: &[Regex], exclude: &[Regex]) -> bool {
    (include.is_empty() || include.iter().any(|pattern| pattern.is_match(url)))
        && !exclude.iter().any(|pattern| pattern.is_match(url))
}

fn normalized_query_parameter_names(values: &[String]) -> HashSet<String> {
    values
        .iter()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .collect()
}

fn is_tracking_parameter(name: &str) -> bool {
    matches!(
        name,
        "gclid" | "dclid" | "fbclid" | "msclkid" | "mc_cid" | "mc_eid" | "_ga" | "_gl"
    ) || name.starts_with("utm_")
}

/// Canonicalize only RFC 3986 "unreserved" percent escapes.
///
/// Decoding reserved characters (for example `%2F` to `/`) can change the
/// resource a server serves, so the crawler deliberately leaves those escapes
/// encoded and only upper-cases their hex digits.  This gives the queue a
/// stable identity for equivalent spellings such as `%7E` and `~` without
/// inventing a provider-specific query canonicalizer.
fn canonicalize_unreserved_percent_encoding(value: &str) -> String {
    fn is_unreserved(byte: u8) -> bool {
        byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~')
    }

    let mut output = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(character) = chars.next() {
        if character != '%' {
            output.push(character);
            continue;
        }

        let Some(high) = chars.next() else {
            output.push('%');
            break;
        };
        let Some(low) = chars.next() else {
            output.push('%');
            output.push(high);
            break;
        };
        let Some(high_value) = high.to_digit(16) else {
            output.push('%');
            output.push(high);
            output.push(low);
            continue;
        };
        let Some(low_value) = low.to_digit(16) else {
            output.push('%');
            output.push(high);
            output.push(low);
            continue;
        };

        let byte = ((high_value << 4) | low_value) as u8;
        if is_unreserved(byte) {
            output.push(byte as char);
        } else {
            output.push('%');
            output.push_str(&format!("{byte:02X}"));
        }
    }
    output
}

fn rendered_profile_has_unsupported_transport(profile: &CrawlAuthProfile) -> bool {
    !profile.headers.is_empty() || profile.proxy_url.is_some()
}

fn normalize_crawl_url(mut url: url::Url, config: &CrawlConfig) -> url::Url {
    url.set_fragment(None);
    if let Some(host) = url.host_str() {
        let normalized_host = host.trim_end_matches('.').to_ascii_lowercase();
        if normalized_host != host {
            let _ = url.set_host(Some(&normalized_host));
        }
    }
    let default_port = match url.scheme() {
        "http" => Some(80),
        "https" => Some(443),
        _ => None,
    };
    if default_port.is_some_and(|port| url.port() == Some(port)) {
        let _ = url.set_port(None);
    }
    if config.lowercase_path {
        let path = url.path().to_ascii_lowercase();
        url.set_path(&path);
    }
    if config.trim_trailing_slash && url.path().len() > 1 {
        let path = url.path().trim_end_matches('/').to_string();
        url.set_path(&path);
    }
    if !config.keep_query_strings {
        url.set_query(None);
    } else {
        let allowed = normalized_query_parameter_names(&config.allowed_query_parameters);
        let denied = normalized_query_parameter_names(&config.denied_query_parameters);
        if config.strip_tracking_parameters || !allowed.is_empty() || !denied.is_empty() {
            let retained = url
                .query_pairs()
                .filter(|(name, _)| {
                    let name = name.to_ascii_lowercase();
                    (!config.strip_tracking_parameters || !is_tracking_parameter(&name))
                        && (allowed.is_empty() || allowed.contains(&name))
                        && !denied.contains(&name)
                })
                .map(|(name, value)| (name.into_owned(), value.into_owned()))
                .collect::<Vec<_>>();
            if retained.is_empty() {
                url.set_query(None);
            } else {
                let query = url::form_urlencoded::Serializer::new(String::new())
                    .extend_pairs(
                        retained
                            .iter()
                            .map(|(name, value)| (name.as_str(), value.as_str())),
                    )
                    .finish();
                url.set_query(Some(&query));
            }
        }
    }
    // `Url::set_path` intentionally preserves semantic escaping.  Apply the
    // narrower identity normalization after all configured filters so `%7e`
    // and `~` deduplicate while reserved escapes remain untouched.
    let normalized = canonicalize_unreserved_percent_encoding(url.as_str());
    url::Url::parse(&normalized).unwrap_or(url)
}

fn resource_type_enabled(resource_type: &str, config: &CrawlConfig) -> bool {
    match resource_type {
        "image" => config.crawl_images,
        "stylesheet" => config.crawl_stylesheets,
        "script" => config.crawl_scripts,
        _ => config.crawl_other_resources,
    }
}

fn read_be_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u16::from_be_bytes([*bytes.get(offset)?, *bytes.get(offset + 1)?]) as usize)
}

fn read_be_u32(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u32::from_be_bytes([
        *bytes.get(offset)?,
        *bytes.get(offset + 1)?,
        *bytes.get(offset + 2)?,
        *bytes.get(offset + 3)?,
    ]) as usize)
}

fn read_le_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u16::from_le_bytes([*bytes.get(offset)?, *bytes.get(offset + 1)?]) as usize)
}

fn read_le_u24(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(
        (*bytes.get(offset)? as usize)
            | ((*bytes.get(offset + 1)? as usize) << 8)
            | ((*bytes.get(offset + 2)? as usize) << 16),
    )
}

fn parse_dimension_token(value: &str) -> Option<usize> {
    let value = value.trim();
    let numeric = value
        .strip_suffix("px")
        .unwrap_or(value)
        .trim()
        .parse::<f64>()
        .ok()?;
    (numeric.is_finite() && numeric > 0.0 && numeric <= usize::MAX as f64)
        .then_some(numeric as usize)
}

fn svg_intrinsic_dimensions(bytes: &[u8]) -> Option<(usize, usize)> {
    let text = std::str::from_utf8(bytes).ok()?;
    let document = Html::parse_document(text);
    let selector = Selector::parse("svg").ok()?;
    let svg = document.select(&selector).next()?;
    let width = svg.value().attr("width").and_then(parse_dimension_token);
    let height = svg.value().attr("height").and_then(parse_dimension_token);
    if let (Some(width), Some(height)) = (width, height) {
        return Some((width, height));
    }
    let view_box = svg
        .value()
        .attr("viewBox")
        .or_else(|| svg.value().attr("viewbox"))?;
    let values = view_box
        .split(|character: char| character.is_ascii_whitespace() || character == ',')
        .filter_map(|value| value.trim().parse::<f64>().ok())
        .collect::<Vec<_>>();
    (values.len() >= 4 && values[2] > 0.0 && values[3] > 0.0)
        .then_some((values[2] as usize, values[3] as usize))
}

/// Decode only dimensions from a bounded, already-fetched image prefix. The
/// body itself is discarded immediately and never enters the persisted model.
fn intrinsic_http_image_dimensions(
    content_type: Option<&str>,
    bytes: &[u8],
) -> Option<(usize, usize)> {
    if bytes.is_empty() || bytes.len() > MAX_INTRINSIC_IMAGE_BYTES {
        return None;
    }
    let content_type = content_type.unwrap_or("").to_ascii_lowercase();
    if content_type.contains("svg") || bytes.starts_with(b"<?xml") || bytes.starts_with(b"<svg") {
        return svg_intrinsic_dimensions(bytes);
    }
    // ICO files are the most common favicon format.  The directory contains
    // one or more image entries; choose the largest declared entry so the
    // report reflects the best available favicon candidate without decoding
    // the image body or executing any embedded content.
    if bytes.len() >= 6 && bytes.get(0..4) == Some(&[0, 0, 1, 0]) {
        let count = read_le_u16(bytes, 4)?.min(256);
        let mut largest: Option<(usize, usize)> = None;
        for index in 0..count {
            let offset = 6usize.saturating_add(index.saturating_mul(16));
            if offset.saturating_add(8) > bytes.len() {
                break;
            }
            let width = usize::from(bytes[offset]).max(1);
            let height = usize::from(bytes[offset + 1]).max(1);
            if largest.map_or(true, |(current_width, current_height)| {
                width.saturating_mul(height) > current_width.saturating_mul(current_height)
            }) {
                largest = Some((width, height));
            }
        }
        if largest.is_some() {
            return largest;
        }
    }
    if bytes.get(0..8) == Some(&[137, 80, 78, 71, 13, 10, 26, 10]) {
        return Some((read_be_u32(bytes, 16)?, read_be_u32(bytes, 20)?));
    }
    if bytes.get(0..6) == Some(b"GIF87a") || bytes.get(0..6) == Some(b"GIF89a") {
        return Some((read_le_u16(bytes, 6)?, read_le_u16(bytes, 8)?));
    }
    if bytes.get(0..4) == Some(b"RIFF")
        && bytes.get(8..12) == Some(b"WEBP")
        && bytes.get(12..16) == Some(b"VP8X")
    {
        return Some((
            read_le_u24(bytes, 24)?.saturating_add(1),
            read_le_u24(bytes, 27)?.saturating_add(1),
        ));
    }
    if bytes.get(0..2) == Some(&[0xff, 0xd8]) {
        let mut offset = 2usize;
        while offset + 4 <= bytes.len() {
            if bytes[offset] != 0xff {
                offset += 1;
                continue;
            }
            while offset < bytes.len() && bytes[offset] == 0xff {
                offset += 1;
            }
            let marker = *bytes.get(offset)?;
            offset += 1;
            if marker == 0xd8 || marker == 0xd9 {
                continue;
            }
            let length = read_be_u16(bytes, offset)?;
            if length < 2 || offset.saturating_add(length) > bytes.len() {
                return None;
            }
            let is_sof = matches!(marker, 0xc0..=0xc3 | 0xc5..=0xc7 | 0xc9..=0xcb | 0xcd..=0xcf);
            if is_sof && length >= 7 {
                return Some((
                    read_be_u16(bytes, offset + 5)?,
                    read_be_u16(bytes, offset + 3)?,
                ));
            }
            offset += length;
        }
    }
    None
}

async fn fetch_resource_candidate(
    client: reqwest::Client,
    candidate: ResourceCandidate,
) -> CrawledResource {
    let request_started_at = Instant::now();
    match client.get(&candidate.url).send().await {
        Ok(mut response) => {
            let response_time_ms = request_started_at.elapsed().as_millis() as u64;
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let content_length = response.content_length();
            let mut body = Vec::new();
            let mut body_read_failed = false;
            if candidate.resource_type == "image"
                && response.status().is_success()
                && content_length.map_or(true, |length| length <= MAX_INTRINSIC_IMAGE_BYTES as u64)
            {
                loop {
                    match response.chunk().await {
                        Ok(Some(chunk)) => {
                            if body.len().saturating_add(chunk.len()) > MAX_INTRINSIC_IMAGE_BYTES {
                                body.clear();
                                break;
                            }
                            body.extend_from_slice(&chunk);
                        }
                        Ok(None) => break,
                        Err(_) => {
                            body.clear();
                            body_read_failed = true;
                            break;
                        }
                    }
                }
            }
            let dimensions = intrinsic_http_image_dimensions(content_type.as_deref(), &body);
            CrawledResource {
                source_urls: candidate.source_urls,
                url: candidate.url,
                resource_type: candidate.resource_type,
                http_status: Some(response.status().as_u16()),
                content_type,
                content_length,
                intrinsic_width: dimensions.map(|value| value.0),
                intrinsic_height: dimensions.map(|value| value.1),
                dimensions_source: dimensions.map(|_| "intrinsic-http".to_string()),
                response_time_ms: Some(response_time_ms),
                request_error_kind: body_read_failed.then(|| "resource_body_read".to_string()),
            }
        }
        Err(error) => CrawledResource {
            source_urls: candidate.source_urls,
            url: candidate.url,
            resource_type: candidate.resource_type,
            http_status: None,
            content_type: None,
            content_length: None,
            intrinsic_width: None,
            intrinsic_height: None,
            dimensions_source: None,
            response_time_ms: Some(request_started_at.elapsed().as_millis() as u64),
            request_error_kind: Some(request_error_kind(&error)),
        },
    }
}

fn apply_checked_image_resources(
    images: &mut [CrawledImage],
    resources: &[CrawledResource],
    config: &CrawlConfig,
) {
    let checked_images = resources
        .iter()
        .filter(|resource| resource.resource_type == "image")
        .map(|resource| (resource.url.as_str(), resource))
        .collect::<HashMap<_, _>>();
    for image in images {
        let Ok(url) = url::Url::parse(&image.src) else {
            continue;
        };
        let key = normalize_crawl_url(url, config).to_string();
        if let Some(resource) = checked_images.get(key.as_str()) {
            image.checked_in_run = true;
            image.http_status = resource.http_status;
            image.content_length = resource.content_length;
            image.request_error_kind = resource.request_error_kind.clone();
            if let (Some(width), Some(height)) =
                (resource.intrinsic_width, resource.intrinsic_height)
            {
                let has_width = image.width.is_some();
                let has_height = image.height.is_some();
                if image.width.is_none() {
                    image.width = Some(width);
                }
                if image.height.is_none() {
                    image.height = Some(height);
                }
                if !has_width && !has_height {
                    image.dimensions_source = resource.dimensions_source.clone();
                } else if !has_width || !has_height {
                    image.dimensions_source = Some("mixed".to_string());
                }
            }
        }
        for candidate in &mut image.srcset_resource_checks {
            let Ok(url) = url::Url::parse(&candidate.url) else {
                continue;
            };
            let key = normalize_crawl_url(url, config).to_string();
            if let Some(resource) = checked_images.get(key.as_str()) {
                candidate.checked_in_run = true;
                candidate.http_status = resource.http_status;
                candidate.content_length = resource.content_length;
                candidate.request_error_kind = resource.request_error_kind.clone();
            }
        }
    }
}

fn apply_checked_social_resource_checks(
    checks: &mut [CrawledSocialResourceCheck],
    checked_images: &HashMap<&str, &CrawledResource>,
    config: &CrawlConfig,
) {
    for check in checks {
        let Ok(url) = url::Url::parse(&check.url) else {
            continue;
        };
        let key = normalize_crawl_url(url, config).to_string();
        if let Some(resource) = checked_images.get(key.as_str()) {
            check.checked_in_run = true;
            check.http_status = resource.http_status;
            check.content_type = resource.content_type.clone();
            check.content_length = resource.content_length;
            check.intrinsic_width = resource.intrinsic_width;
            check.intrinsic_height = resource.intrinsic_height;
            check.dimensions_source = resource.dimensions_source.clone();
            check.request_error_kind = resource.request_error_kind.clone();
        }
    }
}

fn apply_checked_social_resources(
    pages: &mut [CrawledPageSummary],
    resources: &[CrawledResource],
    config: &CrawlConfig,
) {
    let checked_images = resources
        .iter()
        .filter(|resource| resource.resource_type == "image")
        .map(|resource| (resource.url.as_str(), resource))
        .collect::<HashMap<_, _>>();
    for page in pages {
        apply_checked_social_resource_checks(
            &mut page.favicon_resource_checks,
            &checked_images,
            config,
        );
        for tag in &mut page.social_meta_tags {
            if let Some(check) = &mut tag.resource_check {
                apply_checked_social_resource_checks(
                    std::slice::from_mut(check),
                    &checked_images,
                    config,
                );
            }
        }
    }
}

fn apply_checked_frame_resources(
    pages: &mut [CrawledPageSummary],
    resources: &[CrawledResource],
    config: &CrawlConfig,
) {
    let checked_resources = resources
        .iter()
        .map(|resource| (resource.url.as_str(), resource))
        .collect::<HashMap<_, _>>();
    for page in pages {
        for frame in &mut page.frames {
            let Some(resolved_url) = frame.resolved_url.as_deref() else {
                continue;
            };
            let Ok(url) = url::Url::parse(resolved_url) else {
                continue;
            };
            let key = normalize_crawl_url(url, config).to_string();
            if let Some(resource) = checked_resources.get(key.as_str()) {
                frame.checked_in_run = true;
                frame.http_status = resource.http_status;
                frame.request_error_kind = resource.request_error_kind.clone();
            }
        }
    }
}

fn bounded_inline_image_uri(value: &str) -> String {
    if value.chars().count() <= MAX_INLINE_IMAGE_URI_CHARS {
        return value.to_string();
    }
    let mut bounded = value
        .chars()
        .take(MAX_INLINE_IMAGE_URI_CHARS)
        .collect::<String>();
    bounded.push_str("…[truncated]");
    bounded
}

fn decode_inline_text_payload(payload: &str) -> Option<String> {
    if payload.len() > 1_000_000 {
        return None;
    }
    let mut bytes = Vec::with_capacity(payload.len());
    let raw = payload.as_bytes();
    let mut index = 0;
    while index < raw.len() {
        if raw[index] == b'%' {
            if index + 2 >= raw.len() {
                return None;
            }
            let high = (raw[index + 1] as char).to_digit(16)? as u8;
            let low = (raw[index + 2] as char).to_digit(16)? as u8;
            bytes.push((high << 4) | low);
            index += 3;
        } else {
            bytes.push(raw[index]);
            index += 1;
        }
    }
    String::from_utf8(bytes).ok()
}

fn svg_attribute(svg: &str, name: &str) -> Option<String> {
    let lower = svg.to_ascii_lowercase();
    let name_lower = name.to_ascii_lowercase();
    let mut offset = 0;
    while let Some(relative) = lower[offset..].find(&name_lower) {
        let start = offset + relative;
        let after_name = start + name_lower.len();
        let rest = lower[after_name..].trim_start();
        if let Some(after_equals) = rest.strip_prefix('=') {
            let quote = after_equals.trim_start().chars().next()?;
            if quote != '\'' && quote != '"' {
                offset = after_name;
                continue;
            }
            let value = &svg[after_name..];
            let value = &value[value.find(quote)? + 1..];
            return Some(value[..value.find(quote)?].trim().to_string());
        }
        offset = after_name;
    }
    None
}

fn svg_numeric_dimension(value: &str) -> Option<usize> {
    let value = value.trim();
    if value.is_empty() || value.ends_with('%') {
        return None;
    }
    let value = value.strip_suffix("px").unwrap_or(value).trim();
    let parsed = value.parse::<f64>().ok()?;
    (parsed.is_finite() && parsed > 0.0).then_some(parsed.round() as usize)
}

fn svg_inline_dimensions(src: &str) -> Option<(usize, usize)> {
    let (_, payload) = src.split_once(',')?;
    let header = src.split_once(',')?.0.to_ascii_lowercase();
    let svg = if header.contains(";base64") {
        let bytes = BASE64_STANDARD.decode(payload.as_bytes()).ok()?;
        String::from_utf8(bytes).ok()?
    } else {
        decode_inline_text_payload(payload)?
    };
    let width = svg_attribute(&svg, "width").and_then(|value| svg_numeric_dimension(&value));
    let height = svg_attribute(&svg, "height").and_then(|value| svg_numeric_dimension(&value));
    if let (Some(width), Some(height)) = (width, height) {
        return Some((width, height));
    }
    let view_box = svg_attribute(&svg, "viewbox")?;
    let values = view_box
        .split(|character: char| character.is_ascii_whitespace() || character == ',')
        .filter_map(|value| value.parse::<f64>().ok())
        .collect::<Vec<_>>();
    if values.len() < 4 || !values[2].is_finite() || !values[3].is_finite() {
        return None;
    }
    svg_numeric_dimension(&values[2].to_string()).and_then(|width| {
        svg_numeric_dimension(&values[3].to_string()).map(|height| (width, height))
    })
}

/// Decode only bounded image data URIs. This is deliberately local:
/// no image request, browser decode, SVG execution or arbitrary data URI is
/// allowed during a static crawl.
fn inline_image_dimensions(src: &str) -> Option<(usize, usize)> {
    let (header, payload) = src.split_once(',')?;
    let header_lower = header.to_ascii_lowercase();
    if !header_lower.starts_with("data:image/") {
        return None;
    }
    if payload.len() > 2_000_000 {
        return None;
    }
    let mime = header_lower
        .strip_prefix("data:")?
        .split(';')
        .next()
        .unwrap_or_default();
    if mime == "image/svg+xml" {
        return svg_inline_dimensions(src);
    }
    if !header_lower.contains(";base64") {
        return None;
    }
    let bytes = BASE64_STANDARD.decode(payload.as_bytes()).ok()?;
    match mime {
        "image/png"
            if bytes.len() >= 24 && bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]) =>
        {
            let width = u32::from_be_bytes(bytes[16..20].try_into().ok()?) as usize;
            let height = u32::from_be_bytes(bytes[20..24].try_into().ok()?) as usize;
            (width > 0 && height > 0).then_some((width, height))
        }
        "image/gif"
            if bytes.len() >= 10
                && (bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a")) =>
        {
            let width = u16::from_le_bytes(bytes[6..8].try_into().ok()?) as usize;
            let height = u16::from_le_bytes(bytes[8..10].try_into().ok()?) as usize;
            (width > 0 && height > 0).then_some((width, height))
        }
        _ => None,
    }
}

fn inline_image_format(src: &str) -> Option<String> {
    let header = src.split_once(',')?.0.to_ascii_lowercase();
    let mime = header
        .strip_prefix("data:image/")?
        .split(';')
        .next()
        .filter(|value| !value.is_empty())?;
    Some(mime.to_string())
}

fn parse_srcset_urls(srcset: &str) -> Vec<String> {
    let mut urls = Vec::new();
    let mut position = 0;
    while position < srcset.len() {
        while position < srcset.len() {
            let character = srcset[position..].chars().next().unwrap();
            if character == ',' || character.is_ascii_whitespace() {
                position += character.len_utf8();
            } else {
                break;
            }
        }
        if position >= srcset.len() {
            break;
        }

        let url_start = position;
        while position < srcset.len() {
            let character = srcset[position..].chars().next().unwrap();
            if character.is_ascii_whitespace() {
                break;
            }
            position += character.len_utf8();
        }
        let raw_url = &srcset[url_start..position];
        let url = raw_url.trim_end_matches(',');
        if !url.is_empty() {
            urls.push(url.to_string());
        }
        if raw_url.ends_with(',') {
            continue;
        }

        let mut parentheses = 0usize;
        while position < srcset.len() {
            let character = srcset[position..].chars().next().unwrap();
            position += character.len_utf8();
            match character {
                '(' => parentheses = parentheses.saturating_add(1),
                ')' => parentheses = parentheses.saturating_sub(1),
                ',' if parentheses == 0 => break,
                _ => {}
            }
        }
    }
    urls
}

fn html_meta_charset(body: &[u8]) -> Option<String> {
    let prefix = String::from_utf8_lossy(&body[..body.len().min(4096)]).to_ascii_lowercase();
    let marker = "charset";
    let start = prefix.find(marker)? + marker.len();
    let tail =
        prefix[start..].trim_start_matches(|character: char| character.is_ascii_whitespace());
    let tail = tail
        .strip_prefix('=')?
        .trim_start_matches(|character: char| character.is_ascii_whitespace());
    let quote = tail
        .chars()
        .next()
        .filter(|character| *character == '\'' || *character == '"');
    let value = if let Some(quote) = quote {
        let value = &tail[quote.len_utf8()..];
        value.split(quote).next()?
    } else {
        tail.split(|character: char| {
            character.is_ascii_whitespace() || character == ';' || character == '>'
        })
        .next()?
    };
    (!value.is_empty()).then(|| value.to_string())
}

fn html_encoding_finding(code: &str, message: String) -> CrawledHtmlValidationFinding {
    CrawledHtmlValidationFinding {
        code: code.into(),
        severity: "Warning".into(),
        message,
        element: None,
        attribute: None,
        value: None,
        line: None,
        column: None,
        source_excerpt: None,
    }
}

fn decode_crawl_html_body(
    body: &[u8],
    http_charset: Option<&str>,
) -> (String, Option<String>, Vec<CrawledHtmlValidationFinding>) {
    let mut findings = Vec::new();
    let document_declared_charset_source = if http_charset.is_none() {
        html_meta_charset(body)
    } else {
        None
    };
    let (encoding, bom_length) = if let Some((encoding, length)) =
        encoding_rs::Encoding::for_bom(body)
    {
        (encoding, length)
    } else {
        let declared = http_charset
            .map(str::trim)
            .filter(|label| !label.is_empty())
            .map(|label| label.trim_matches(['\'', '"']).to_string())
            .or_else(|| html_meta_charset(body));
        match declared {
            Some(label) => match encoding_rs::Encoding::for_label(label.as_bytes()) {
                Some(encoding) => (encoding, 0),
                None => {
                    let mut finding = html_encoding_finding(
                        "encoding-unsupported-label",
                        format!("Nieobsługiwana deklaracja kodowania: {label}. Zastosowano UTF-8 jako fallback."),
                    );
                    if document_declared_charset_source.is_some() {
                        let source = String::from_utf8_lossy(body).into_owned();
                        let source_lower = source.to_ascii_lowercase();
                        if let Some(offset) = source_lower.find("charset") {
                            set_html_finding_source(&mut finding, &source, offset);
                        }
                    }
                    findings.push(finding);
                    (encoding_rs::UTF_8, 0)
                }
            },
            None => (encoding_rs::UTF_8, 0),
        }
    };
    let (decoded, _, had_errors) = encoding.decode(&body[bom_length..]);
    let decoded = decoded.into_owned();
    if had_errors {
        let mut finding = html_encoding_finding(
            "encoding-invalid-byte-sequence",
            format!("Dekodowanie {} zawierało nieprawidłową sekwencję bajtów; dekoder zastąpił ją znakiem zastępczym.", encoding.name()),
        );
        if let Some(offset) = decoded.find('\u{FFFD}') {
            set_html_finding_source(&mut finding, &decoded, offset);
        }
        findings.push(finding);
    }
    (decoded, Some(encoding.name().to_string()), findings)
}

fn is_valid_percent_encoding(value: &str) -> bool {
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len()
                || !bytes[index + 1].is_ascii_hexdigit()
                || !bytes[index + 2].is_ascii_hexdigit()
            {
                return false;
            }
            index += 3;
        } else {
            index += 1;
        }
    }
    true
}

fn push_html_validation_finding(
    findings: &mut Vec<CrawledHtmlValidationFinding>,
    truncated: &mut bool,
    finding: CrawledHtmlValidationFinding,
) {
    if findings.len() < MAX_HTML_VALIDATION_FINDINGS_PER_PAGE {
        findings.push(finding);
    } else {
        *truncated = true;
    }
}

fn locate_html_attribute(
    source: &str,
    source_lower: &str,
    element: &str,
    attribute: &str,
    expected_value: &str,
    occurrence: usize,
) -> Option<usize> {
    let opening = format!("<{}", element.to_ascii_lowercase());
    let mut search_from = 0usize;
    let mut matched = 0usize;
    while let Some(relative) = source_lower.get(search_from..)?.find(&opening) {
        let tag_start = search_from + relative;
        let after_name = tag_start + opening.len();
        if source_lower[after_name..]
            .chars()
            .next()
            .is_some_and(|character| {
                !(character.is_ascii_whitespace() || character == '/' || character == '>')
            })
        {
            search_from = after_name;
            continue;
        }
        let mut quote = None;
        let mut tag_end = None;
        for (offset, character) in source[after_name..].char_indices() {
            if let Some(active) = quote {
                if character == active {
                    quote = None;
                }
            } else if character == '\'' || character == '"' {
                quote = Some(character);
            } else if character == '>' {
                tag_end = Some(after_name + offset);
                break;
            }
        }
        let tag_end = tag_end?;
        let tag = &source[after_name..tag_end];
        let tag_lower = tag.to_ascii_lowercase();
        let mut cursor = 0usize;
        while let Some(relative_attribute) = tag_lower
            .get(cursor..)?
            .find(&attribute.to_ascii_lowercase())
        {
            let name_start = cursor + relative_attribute;
            let name_end = name_start + attribute.len();
            let before_ok = name_start == 0 || tag.as_bytes()[name_start - 1].is_ascii_whitespace();
            let after_ok = tag
                .as_bytes()
                .get(name_end)
                .map_or(true, |byte| byte.is_ascii_whitespace() || *byte == b'=');
            if !before_ok || !after_ok {
                cursor = name_end;
                continue;
            }
            cursor = name_end;
            while tag[cursor..]
                .chars()
                .next()
                .is_some_and(|character| character.is_ascii_whitespace())
            {
                cursor += tag[cursor..].chars().next()?.len_utf8();
            }
            if tag.as_bytes().get(cursor) != Some(&b'=') {
                continue;
            }
            cursor += 1;
            while tag[cursor..]
                .chars()
                .next()
                .is_some_and(|character| character.is_ascii_whitespace())
            {
                cursor += tag[cursor..].chars().next()?.len_utf8();
            }
            let (value_start, value_end) =
                if let Some(quote @ ('\'' | '"')) = tag[cursor..].chars().next() {
                    cursor += quote.len_utf8();
                    let value_start = cursor;
                    while tag[cursor..]
                        .chars()
                        .next()
                        .is_some_and(|character| character != quote)
                    {
                        cursor += tag[cursor..].chars().next()?.len_utf8();
                    }
                    (value_start, cursor)
                } else {
                    let value_start = cursor;
                    while tag[cursor..].chars().next().is_some_and(|character| {
                        !character.is_ascii_whitespace() && character != '>'
                    }) {
                        cursor += tag[cursor..].chars().next()?.len_utf8();
                    }
                    (value_start, cursor)
                };
            if tag[value_start..value_end] == *expected_value {
                if matched == occurrence {
                    return Some(after_name + value_start);
                }
                matched += 1;
            }
            break;
        }
        search_from = tag_end + 1;
    }
    None
}

fn set_html_finding_source(
    finding: &mut CrawledHtmlValidationFinding,
    source: &str,
    offset: usize,
) {
    let offset = offset.min(source.len());
    let prefix = &source[..offset];
    let line_start = prefix.rfind('\n').map_or(0, |index| index + 1);
    let line_end = source[offset..]
        .find('\n')
        .map_or(source.len(), |index| offset + index);
    let mut excerpt_start = line_start.max(offset.saturating_sub(100));
    let mut excerpt_end = line_end.min(offset.saturating_add(140));
    while !source.is_char_boundary(excerpt_start) {
        excerpt_start += 1;
    }
    while !source.is_char_boundary(excerpt_end) {
        excerpt_end -= 1;
    }
    finding.line = Some(prefix.bytes().filter(|byte| *byte == b'\n').count() + 1);
    finding.column = Some(source[line_start..offset].chars().count() + 1);
    finding.source_excerpt = Some(source[excerpt_start..excerpt_end].trim().to_string());
}

fn document_declares_meta_charset(document: &Html) -> bool {
    let Ok(meta_selector) = Selector::parse("meta") else {
        return false;
    };
    document.select(&meta_selector).any(|meta| {
        if meta
            .value()
            .attr("charset")
            .is_some_and(|value| !value.trim().is_empty())
        {
            return true;
        }
        meta.value()
            .attr("http-equiv")
            .is_some_and(|value| value.trim().eq_ignore_ascii_case("content-type"))
            && meta.value().attr("content").is_some_and(|value| {
                value
                    .to_ascii_lowercase()
                    .split(';')
                    .any(|part| part.trim_start().starts_with("charset="))
            })
    })
}

fn validate_crawl_html_with_charset(
    document: &Html,
    decoded_html: &str,
    base_url: &url::Url,
    http_charset: Option<&str>,
) -> (Vec<CrawledHtmlValidationFinding>, bool) {
    let mut findings = Vec::new();
    let mut truncated = false;
    let raw_lower = decoded_html.to_ascii_lowercase();
    let doctype_declarations = raw_lower
        .match_indices("<!doctype")
        .map(|(offset, _)| {
            let declaration_end = raw_lower[offset..]
                .find('>')
                .map_or(raw_lower.len(), |relative| offset + relative + 1);
            (offset, declaration_end)
        })
        .collect::<Vec<_>>();
    let is_html_doctype = |(offset, end): &(usize, usize)| {
        let declaration = raw_lower[offset + "<!doctype".len()..*end].trim_start();
        declaration.strip_prefix("html").is_some_and(|tail| {
            tail.is_empty() || tail.starts_with('>') || tail.starts_with(char::is_whitespace)
        })
    };
    if doctype_declarations.is_empty() {
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-doctype-missing".into(),
            severity: "Warning".into(),
            message: "Nie wykryto deklaracji <!doctype html>; przeglądarka może użyć trybu quirks."
                .into(),
            element: Some("html".into()),
            attribute: None,
            value: None,
            line: None,
            column: None,
            source_excerpt: None,
        };
        if !decoded_html.is_empty() {
            set_html_finding_source(&mut finding, decoded_html, 0);
        }
        push_html_validation_finding(&mut findings, &mut truncated, finding);
    } else if !doctype_declarations.iter().any(is_html_doctype) {
        let (offset, end) = doctype_declarations[0];
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-doctype-invalid".into(),
            severity: "Warning".into(),
            message: "Wykryta deklaracja doctype nie wskazuje dokumentu HTML5.".into(),
            element: Some("!doctype".into()),
            attribute: None,
            value: Some(decoded_html[offset..end].chars().take(240).collect()),
            line: None,
            column: None,
            source_excerpt: None,
        };
        set_html_finding_source(&mut finding, decoded_html, offset);
        push_html_validation_finding(&mut findings, &mut truncated, finding);
    }
    if doctype_declarations.len() > 1 {
        let (offset, end) = doctype_declarations[1];
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-doctype-duplicate".into(),
            severity: "Warning".into(),
            message: "Dokument zawiera więcej niż jedną deklarację doctype.".into(),
            element: Some("!doctype".into()),
            attribute: None,
            value: Some(decoded_html[offset..end].chars().take(240).collect()),
            line: None,
            column: None,
            source_excerpt: None,
        };
        set_html_finding_source(&mut finding, decoded_html, offset);
        push_html_validation_finding(&mut findings, &mut truncated, finding);
    }

    let html_selector = Selector::parse("html").expect("valid html selector");
    let html_element = document.select(&html_selector).next();
    let document_language = html_element
        .and_then(|element| element.value().attr("lang"))
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if document_language.is_none() {
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-lang-missing".into(),
            severity: "Warning".into(),
            message: "Nie wykryto niepustego atrybutu lang na elemencie html; technologie asystujące mogą błędnie dobrać język wymowy.".into(),
            element: Some("html".into()),
            attribute: Some("lang".into()),
            value: None,
            line: None,
            column: None,
            source_excerpt: None,
        };
        if let Some(offset) = raw_lower.find("<html") {
            set_html_finding_source(&mut finding, decoded_html, offset);
        } else if !decoded_html.is_empty() {
            set_html_finding_source(&mut finding, decoded_html, 0);
        }
        push_html_validation_finding(&mut findings, &mut truncated, finding);
    }

    if http_charset.is_none() && !document_declares_meta_charset(document) {
        let mut finding = CrawledHtmlValidationFinding {
            code: "html-meta-charset-missing".into(),
            severity: "Warning".into(),
            message: "Nie wykryto deklaracji charsetu w dokumencie HTML ani w nagłówku HTTP; dekodowanie może zależeć od heurystyki.".into(),
            element: Some("meta".into()),
            attribute: Some("charset".into()),
            value: None,
            line: None,
            column: None,
            source_excerpt: None,
        };
        if let Some(offset) = raw_lower.find("<head") {
            set_html_finding_source(&mut finding, decoded_html, offset);
        } else if let Some(offset) = raw_lower.find("<html") {
            set_html_finding_source(&mut finding, decoded_html, offset);
        } else if !decoded_html.is_empty() {
            set_html_finding_source(&mut finding, decoded_html, 0);
        }
        push_html_validation_finding(&mut findings, &mut truncated, finding);
    }

    let Ok(all_elements) = Selector::parse("*") else {
        return (findings, truncated);
    };
    let mut seen_ids = HashSet::new();
    let mut id_tag_occurrences = HashMap::<(String, String), usize>::new();
    let mut uri_occurrences = HashMap::<(String, String, String), usize>::new();
    let source_lower = decoded_html.to_ascii_lowercase();
    let mut checked_uris = 0usize;
    const MAX_URI_REFERENCES_PER_PAGE: usize = 20_000;
    const URI_ATTRIBUTES: [&str; 9] = [
        "href",
        "src",
        "action",
        "formaction",
        "poster",
        "cite",
        "data",
        "manifest",
        "xlink:href",
    ];
    for element in document.select(&all_elements) {
        if let Some(id) = element
            .value()
            .attr("id")
            .map(str::trim)
            .filter(|id| !id.is_empty())
        {
            let element_name = element.value().name().to_string();
            let occurrence = id_tag_occurrences
                .entry((element_name.clone(), id.to_string()))
                .or_default();
            let tag_occurrence = *occurrence;
            *occurrence += 1;
            if !seen_ids.insert(id.to_string()) {
                let mut finding = CrawledHtmlValidationFinding {
                    code: "html-duplicate-id".into(),
                    severity: "Warning".into(),
                    message: "Wartość id nie jest unikalna w dokumencie.".into(),
                    element: Some(element.value().name().to_string()),
                    attribute: Some("id".into()),
                    value: Some(id.chars().take(240).collect()),
                    line: None,
                    column: None,
                    source_excerpt: None,
                };
                if let Some(offset) = locate_html_attribute(
                    decoded_html,
                    &source_lower,
                    &element_name,
                    "id",
                    id,
                    tag_occurrence,
                ) {
                    set_html_finding_source(&mut finding, decoded_html, offset);
                }
                push_html_validation_finding(&mut findings, &mut truncated, finding);
            }
        }
        for (attribute, value) in element.value().attrs() {
            if !URI_ATTRIBUTES.contains(&attribute) || value.trim().is_empty() {
                continue;
            }
            checked_uris += 1;
            if checked_uris > MAX_URI_REFERENCES_PER_PAGE {
                truncated = true;
                break;
            }
            let value = value.trim();
            if value.starts_with('#')
                || value.contains("{{")
                || value.contains("${")
                || value.starts_with("<%")
            {
                continue;
            }
            let has_valid_scheme = [
                "mailto:",
                "tel:",
                "javascript:",
                "data:",
                "blob:",
                "about:",
                "ftp:",
            ]
            .iter()
            .any(|scheme| value.to_ascii_lowercase().starts_with(scheme));
            let malformed = value.contains(char::is_whitespace)
                || !is_valid_percent_encoding(value)
                || (!has_valid_scheme && base_url.join(value).is_err());
            if malformed {
                let occurrence_key = (
                    element.value().name().to_string(),
                    attribute.to_string(),
                    value.to_string(),
                );
                let occurrence = uri_occurrences.entry(occurrence_key).or_default();
                let mut finding = CrawledHtmlValidationFinding {
                        code: "html-uri-invalid".into(),
                        severity: "Warning".into(),
                        message: "Wartość atrybutu URI ma niepoprawne kodowanie procentowe lub nie daje się rozwiązać względem URL strony.".into(),
                        element: Some(element.value().name().to_string()),
                        attribute: Some(attribute.to_string()),
                        value: Some(value.chars().take(240).collect()),
                        line: None,
                        column: None,
                        source_excerpt: None,
                    };
                if let Some(offset) = locate_html_attribute(
                    decoded_html,
                    &source_lower,
                    element.value().name(),
                    attribute,
                    value,
                    *occurrence,
                ) {
                    set_html_finding_source(&mut finding, decoded_html, offset);
                }
                push_html_validation_finding(&mut findings, &mut truncated, finding);
                *occurrence += 1;
            }
        }
        if checked_uris > MAX_URI_REFERENCES_PER_PAGE {
            break;
        }
    }
    (findings, truncated)
}

fn add_resource_candidate(
    candidates: &mut HashMap<String, ResourceCandidate>,
    source_url: &str,
    base: &url::Url,
    href: &str,
    resource_type: &str,
    base_host: &str,
    config: &CrawlConfig,
) {
    if !resource_type_enabled(resource_type, config) {
        return;
    }
    let Ok(resolved) = base.join(href) else {
        return;
    };
    let Ok(validated) = validate_and_normalize_url(resolved.as_str()) else {
        return;
    };
    if !matches_scope(
        &validated,
        base_host,
        config.allow_subdomains,
        config.scope_path.as_deref(),
        &config.allowed_hosts,
    ) {
        return;
    }
    let url = normalize_crawl_url(validated, config).to_string();
    if !candidates.contains_key(&url) && candidates.len() >= MAX_RESOURCE_DISCOVERY_CANDIDATES {
        return;
    }
    let candidate = candidates
        .entry(url.clone())
        .or_insert_with(|| ResourceCandidate {
            source_urls: Vec::new(),
            url,
            resource_type: resource_type.into(),
        });
    if candidate.source_urls.len() < 100
        && !candidate
            .source_urls
            .iter()
            .any(|value| value == source_url)
    {
        candidate.source_urls.push(source_url.to_owned());
    }
}

fn is_other_resource_url(url: &url::Url) -> bool {
    let path = url.path().to_ascii_lowercase();
    [
        ".pdf", ".xml", ".json", ".zip", ".csv", ".txt", ".woff", ".woff2", ".ttf", ".otf", ".mp4",
        ".webm", ".mp3", ".wav",
    ]
    .iter()
    .any(|extension| path.ends_with(extension))
}

const MAX_FILTER_PATTERNS: usize = 100;
const MAX_FILTER_PATTERN_LENGTH: usize = 2_048;
const MAX_FILTER_PREVIEW_URLS: usize = 500;

fn compile_filter_patterns(
    patterns: &[String],
    filter: &str,
) -> Result<Vec<Regex>, CrawlFilterValidationError> {
    if patterns.len() > MAX_FILTER_PATTERNS {
        return Err(CrawlFilterValidationError {
            filter: filter.into(),
            pattern: String::new(),
            message: format!("A maximum of {MAX_FILTER_PATTERNS} patterns is allowed."),
        });
    }

    patterns
        .iter()
        .map(|pattern| {
            if pattern.chars().count() > MAX_FILTER_PATTERN_LENGTH {
                return Err(CrawlFilterValidationError {
                    filter: filter.into(),
                    pattern: pattern.clone(),
                    message: format!(
                        "Pattern is longer than {MAX_FILTER_PATTERN_LENGTH} characters."
                    ),
                });
            }
            Regex::new(pattern).map_err(|error| CrawlFilterValidationError {
                filter: filter.into(),
                pattern: pattern.clone(),
                message: error.to_string(),
            })
        })
        .collect()
}

fn filter_preview(url: String, include: &[Regex], exclude: &[Regex]) -> CrawlFilterPreview {
    let included_by_include =
        include.is_empty() || include.iter().any(|pattern| pattern.is_match(&url));
    let excluded_by_exclude = exclude.iter().any(|pattern| pattern.is_match(&url));
    let (included, reason) = if !included_by_include {
        (false, "Does not match any include pattern".into())
    } else if excluded_by_exclude {
        (false, "Matches an exclude pattern".into())
    } else {
        (true, "Accepted by the configured filters".into())
    };
    CrawlFilterPreview {
        url,
        included,
        reason,
    }
}

#[tauri::command]
pub fn validate_crawl_filters(
    include_patterns: Vec<String>,
    exclude_patterns: Vec<String>,
    preview_urls: Vec<String>,
) -> CrawlFilterValidationResult {
    let include = compile_filter_patterns(&include_patterns, "include");
    let exclude = compile_filter_patterns(&exclude_patterns, "exclude");
    let mut errors = Vec::new();
    if let Err(error) = &include {
        errors.push(error.clone());
    }
    if let Err(error) = &exclude {
        errors.push(error.clone());
    }
    if !errors.is_empty() {
        return CrawlFilterValidationResult {
            valid: false,
            errors,
            previews: Vec::new(),
        };
    }

    let include = include.expect("validated include patterns");
    let exclude = exclude.expect("validated exclude patterns");
    let previews = preview_urls
        .into_iter()
        .filter(|url| !url.trim().is_empty())
        .take(MAX_FILTER_PREVIEW_URLS)
        .map(|url| filter_preview(url, &include, &exclude))
        .collect();
    CrawlFilterValidationResult {
        valid: true,
        errors: Vec::new(),
        previews,
    }
}

fn parse_robots_rules(content: &str, crawler_agent: &str) -> Vec<RobotsRule> {
    let agent = crawler_agent.to_ascii_lowercase();
    let use_specific_group = robots_has_specific_agent_group(content, &agent);
    let mut rules = Vec::new();
    let mut active_group = false;
    let mut saw_rule = false;
    for raw_line in content.lines() {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        let Some((key, raw_value)) = line.split_once(':') else {
            continue;
        };
        let key = key.trim().to_ascii_lowercase();
        let value = raw_value.trim();
        if key == "user-agent" {
            if saw_rule {
                active_group = false;
                saw_rule = false;
            }
            let requested = value.to_ascii_lowercase();
            let matches = if use_specific_group {
                requested != "*" && agent.contains(&requested)
            } else {
                requested == "*"
            };
            active_group = active_group || matches;
            continue;
        }
        if active_group && (key == "allow" || key == "disallow") {
            saw_rule = true;
            if !value.is_empty() {
                rules.push(RobotsRule {
                    allow: key == "allow",
                    path: value.to_string(),
                });
            }
        }
    }
    rules
}

fn parse_robots_crawl_delay(content: &str, crawler_agent: &str) -> Option<std::time::Duration> {
    let agent = crawler_agent.to_ascii_lowercase();
    let use_specific_group = robots_has_specific_agent_group(content, &agent);
    let mut active_group = false;
    let mut saw_directive = false;
    let mut crawl_delay = None;
    for raw_line in content.lines() {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        let Some((key, raw_value)) = line.split_once(':') else {
            continue;
        };
        let key = key.trim().to_ascii_lowercase();
        let value = raw_value.trim();
        if key == "user-agent" {
            if saw_directive {
                active_group = false;
                saw_directive = false;
            }
            let requested = value.to_ascii_lowercase();
            let matches = if use_specific_group {
                requested != "*" && agent.contains(&requested)
            } else {
                requested == "*"
            };
            active_group = active_group || matches;
            continue;
        }
        if active_group && (key == "allow" || key == "disallow" || key == "crawl-delay") {
            saw_directive = true;
        }
        if active_group && key == "crawl-delay" {
            if let Ok(seconds) = value.parse::<f64>() {
                if seconds.is_finite() && seconds > 0.0 {
                    crawl_delay = Some(std::time::Duration::from_millis(
                        (seconds * 1_000.0).round().clamp(1.0, 60_000.0) as u64,
                    ));
                }
            }
        }
    }
    crawl_delay
}

const ROBOTS_AGENT_MATRIX: [&str; 7] = [
    "Googlebot",
    "Bingbot",
    "GPTBot",
    "ClaudeBot",
    "Google-Extended",
    "Applebot",
    "*",
];

fn build_robots_agent_matrix(content: &str, effective_user_agent: &str) -> Vec<CrawledRobotsAgent> {
    let mut identities = Vec::with_capacity(ROBOTS_AGENT_MATRIX.len() + 1);
    identities.push(effective_user_agent.trim().to_string());
    identities.extend(ROBOTS_AGENT_MATRIX.iter().map(|agent| (*agent).to_string()));
    let mut seen = HashSet::new();
    identities
        .into_iter()
        .filter(|agent| !agent.is_empty() && seen.insert(agent.to_ascii_lowercase()))
        .map(|user_agent| {
            let rules = parse_robots_rules(content, &user_agent);
            let crawl_delay = parse_robots_crawl_delay(content, &user_agent)
                .map(|delay| delay.as_millis().min(u64::MAX as u128) as u64);
            let normalized_agent = user_agent.to_ascii_lowercase();
            CrawledRobotsAgent {
                specific_group: robots_has_specific_agent_group(content, &normalized_agent),
                user_agent,
                applicable_rules: rules
                    .into_iter()
                    .take(MAX_ROBOTS_RULES)
                    .map(|rule| CrawledRobotsRule {
                        directive: if rule.allow { "allow" } else { "disallow" }.into(),
                        path: rule.path,
                    })
                    .collect(),
                crawl_delay_ms: crawl_delay,
            }
        })
        .collect()
}

fn robots_has_specific_agent_group(content: &str, crawler_agent: &str) -> bool {
    content.lines().any(|raw_line| {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        let Some((key, value)) = line.split_once(':') else {
            return false;
        };
        key.trim().eq_ignore_ascii_case("user-agent")
            && !value.trim().eq_ignore_ascii_case("*")
            && crawler_agent.contains(&value.trim().to_ascii_lowercase())
    })
}

async fn wait_for_crawl_delay(
    control: &CrawlControl,
    run_id: &str,
    last_request_at: Instant,
    delay: std::time::Duration,
) -> bool {
    while let Some(remaining) = delay.checked_sub(last_request_at.elapsed()) {
        if control.is_cancelled(run_id) {
            return false;
        }
        if control.is_paused(run_id) && !control.wait_until_resumed(run_id).await {
            return false;
        }
        tokio::time::sleep(remaining.min(std::time::Duration::from_millis(100))).await;
    }
    !control.is_cancelled(run_id)
}

fn robots_deciding_rule<'a>(url: &url::Url, rules: &'a [RobotsRule]) -> Option<&'a RobotsRule> {
    let requested = match url.query() {
        Some(query) => format!("{}?{}", url.path(), query),
        None => url.path().to_string(),
    };
    let mut best: Option<&RobotsRule> = None;
    for rule in rules {
        if robots_path_matches(&rule.path, &requested)
            && best
                .map(|current| {
                    robots_rule_specificity(&rule.path) > robots_rule_specificity(&current.path)
                        || (robots_rule_specificity(&rule.path)
                            == robots_rule_specificity(&current.path)
                            && rule.allow
                            && !current.allow)
                })
                .unwrap_or(true)
        {
            best = Some(rule);
        }
    }
    best
}

fn robots_rule_specificity(pattern: &str) -> usize {
    pattern
        .trim_end_matches('$')
        .bytes()
        .filter(|byte| *byte != b'*')
        .count()
}

fn robots_path_matches(pattern: &str, requested: &str) -> bool {
    let anchored = pattern.ends_with('$');
    let pattern = pattern.strip_suffix('$').unwrap_or(pattern);
    let pattern = percent_decode_robots_path(pattern);
    let requested = percent_decode_robots_path(requested);
    let regex_pattern = format!(
        "^{}{}",
        pattern
            .split('*')
            .map(regex::escape)
            .collect::<Vec<_>>()
            .join(".*"),
        if anchored { "$" } else { "" }
    );
    Regex::new(&regex_pattern)
        .map(|regex| regex.is_match(&requested))
        .unwrap_or(false)
}

/// Decode valid percent-encoded octets before matching robots paths. URL
/// parsers preserve escaped bytes in `Url::path()`, while robots rules are
/// commonly authored with either the escaped or human-readable spelling.
/// Invalid escapes are kept verbatim so malformed rules remain harmless and
/// deterministic instead of becoming a broader match.
fn percent_decode_robots_path(value: &str) -> String {
    fn hex_digit(value: u8) -> Option<u8> {
        match value {
            b'0'..=b'9' => Some(value - b'0'),
            b'a'..=b'f' => Some(value - b'a' + 10),
            b'A'..=b'F' => Some(value - b'A' + 10),
            _ => None,
        }
    }

    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) =
                (hex_digit(bytes[index + 1]), hex_digit(bytes[index + 2]))
            {
                decoded.push((high << 4) | low);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&decoded).into_owned()
}

fn robots_allows(url: &url::Url, rules: &[RobotsRule]) -> bool {
    robots_deciding_rule(url, rules).map_or(true, |rule| rule.allow)
}

fn parse_sitemap_directives(content: &str) -> Vec<String> {
    content
        .lines()
        .filter_map(|raw_line| {
            let line = raw_line.split('#').next().unwrap_or("").trim();
            let (key, value) = line.split_once(':')?;
            (key.trim().eq_ignore_ascii_case("sitemap") && !value.trim().is_empty())
                .then(|| value.trim().to_string())
        })
        .collect()
}

fn parse_sitemap_locations(content: &str) -> Vec<String> {
    Regex::new(r"(?is)<loc\s*>\s*(.*?)\s*</loc>")
        .ok()
        .map(|pattern| {
            pattern
                .captures_iter(content)
                .filter_map(|captures| captures.get(1))
                .map(|capture| capture.as_str().trim().to_string())
                .filter(|url| !url.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn duplicate_heading_groups(document: &Html, selector: &Selector) -> Vec<CrawledDuplicateHeading> {
    let mut indexes = HashMap::<String, usize>::new();
    let mut groups = Vec::<CrawledDuplicateHeading>::new();

    for element in document.select(selector) {
        let Some(level) = element
            .value()
            .name()
            .strip_prefix('h')
            .and_then(|value| value.parse::<usize>().ok())
            .filter(|level| (1..=6).contains(level))
        else {
            continue;
        };
        let text = element.text().collect::<String>();
        let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
        if text.is_empty() {
            continue;
        }

        let normalized = text.to_lowercase();
        if let Some(index) = indexes.get(&normalized).copied() {
            let group = &mut groups[index];
            group.occurrences += 1;
            if !group.levels.contains(&level) {
                group.levels.push(level);
                group.levels.sort_unstable();
            }
        } else {
            indexes.insert(normalized, groups.len());
            groups.push(CrawledDuplicateHeading {
                text,
                levels: vec![level],
                occurrences: 1,
            });
        }
    }

    groups.retain(|group| group.occurrences > 1);
    groups
}

/// Returns normalized text from the primary content region only. Site chrome
/// (header, navigation, footer, aside/sidebar, hidden consent UI and scripts)
/// is excluded so content metrics and duplicate fingerprints describe the
/// document being audited rather than its application shell.
fn semantic_content_text(document: &Html) -> String {
    let body_selector = Selector::parse("body").expect("static body selector is valid");
    let Some(body) = document.select(&body_selector).next() else {
        return String::new();
    };
    let has_primary_root = has_semantic_content_root(document);
    let mut text = Vec::new();
    for node in body.descendants() {
        let Node::Text(value) = node.value() else {
            continue;
        };
        let Some(parent) = node.parent().and_then(ElementRef::wrap) else {
            continue;
        };
        if !semantic_content_contains(&parent, has_primary_root)
            || matches!(
                parent.value().name(),
                "script" | "style" | "noscript" | "svg" | "template"
            )
            || parent
                .ancestors()
                .filter_map(ElementRef::wrap)
                .any(|ancestor| {
                    matches!(
                        ancestor.value().name(),
                        "script" | "style" | "noscript" | "svg" | "template"
                    )
                })
        {
            continue;
        }
        text.push(value.to_string());
    }
    text.join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalized_content_fingerprint(document: &Html) -> (usize, Option<String>) {
    let text = semantic_content_text(document);
    let word_count = text.split_whitespace().count();
    if text.is_empty() {
        return (0, None);
    }
    let hash = Sha256::digest(text.to_ascii_lowercase().as_bytes());
    (word_count, Some(format!("{:x}", hash)))
}

fn content_simhash(document: &Html) -> Option<String> {
    let words = semantic_content_text(document)
        .split_whitespace()
        .map(|word| word.to_ascii_lowercase())
        .collect::<Vec<_>>();
    if words.is_empty() {
        return None;
    }
    let features = if words.len() >= 3 {
        words
            .windows(3)
            .map(|window| window.join(" "))
            .collect::<Vec<_>>()
    } else {
        words
    };
    let mut weights = [0i32; 64];
    for feature in features {
        let digest = Sha256::digest(feature.as_bytes());
        let bits = u64::from_be_bytes(
            digest[..8]
                .try_into()
                .expect("SHA-256 always has at least 8 bytes"),
        );
        for (bit, weight) in weights.iter_mut().enumerate() {
            if bits & (1u64 << bit) == 0 {
                *weight -= 1;
            } else {
                *weight += 1;
            }
        }
    }
    let value = weights
        .iter()
        .enumerate()
        .fold(0u64, |value, (bit, weight)| {
            if *weight >= 0 {
                value | (1u64 << bit)
            } else {
                value
            }
        });
    Some(format!("{value:016x}"))
}

fn simhash_distance(left: &str, right: &str) -> Option<u32> {
    let left = u64::from_str_radix(left, 16).ok()?;
    let right = u64::from_str_radix(right, 16).ok()?;
    Some((left ^ right).count_ones())
}

fn near_duplicate_pairs(signatures: &[(usize, String)]) -> Vec<(usize, usize, u32)> {
    const MAX_DISTANCE: u32 = 7;
    let parsed = signatures
        .iter()
        .filter_map(|(index, signature)| {
            u64::from_str_radix(signature, 16)
                .ok()
                .map(|value| (*index, value))
        })
        .collect::<Vec<_>>();
    let mut buckets: std::collections::HashMap<(usize, u8), Vec<(usize, u64)>> =
        std::collections::HashMap::new();
    let mut pairs = HashSet::new();
    for (index, signature) in parsed {
        for band in 0..8 {
            let key = (band, ((signature >> (band * 8)) & 0xff) as u8);
            for (candidate_index, candidate_signature) in buckets.entry(key).or_default().iter() {
                let (left, right) = if index < *candidate_index {
                    (index, *candidate_index)
                } else {
                    (*candidate_index, index)
                };
                if (signature ^ *candidate_signature).count_ones() <= MAX_DISTANCE {
                    pairs.insert((left, right));
                }
            }
            buckets.entry(key).or_default().push((index, signature));
        }
    }
    let mut result = pairs
        .into_iter()
        .filter_map(|(left, right)| {
            let left_signature = signatures
                .iter()
                .find_map(|(index, signature)| (*index == left).then_some(signature))?;
            let right_signature = signatures
                .iter()
                .find_map(|(index, signature)| (*index == right).then_some(signature))?;
            simhash_distance(left_signature, right_signature)
                .map(|distance| (left, right, distance))
        })
        .collect::<Vec<_>>();
    result.sort_by_key(|(left, right, _)| (*left, *right));
    result
}

#[derive(Debug, Default)]
struct ContentMetrics {
    word_count: usize,
    content_hash: Option<String>,
    text_ratio_percent: Option<f64>,
    reading_time_minutes: Option<usize>,
    sentence_count: Option<usize>,
    average_words_per_sentence: Option<f64>,
    average_characters_per_word: Option<f64>,
    complexity_score: Option<u8>,
    complexity_label: Option<String>,
    readability_ease_score: Option<f64>,
    readability_grade: Option<f64>,
    readability_method: Option<String>,
    readability_label: Option<String>,
    content_terms: Vec<CrawledContentTerm>,
}

fn estimate_syllables(word: &str) -> usize {
    let normalized = word.to_lowercase();
    let mut count = 0;
    let mut previous_vowel = false;
    for character in normalized.chars() {
        let vowel = matches!(
            character,
            'a' | 'e' | 'i' | 'o' | 'u' | 'y' | 'ą' | 'ę' | 'ó' | 'à' | 'è' | 'ì' | 'ò' | 'ù'
        );
        if vowel && !previous_vowel {
            count += 1;
        }
        previous_vowel = vowel;
    }
    if normalized.chars().count() > 2
        && normalized.ends_with('e')
        && count > 1
        && !normalized.ends_with("le")
    {
        count -= 1;
    }
    count.max(1)
}

fn readability_label(score: f64) -> String {
    if score >= 80.0 {
        "very-easy".into()
    } else if score >= 60.0 {
        "standard".into()
    } else if score >= 30.0 {
        "difficult".into()
    } else {
        "very-difficult".into()
    }
}

fn normalized_language(language: Option<&str>) -> Option<&str> {
    language
        .and_then(|value| value.split(['-', '_']).next())
        .filter(|value| !value.is_empty())
}

fn readability_formula(
    language: Option<&str>,
    words: usize,
    sentences: usize,
    syllables: usize,
) -> (f64, f64, &'static str) {
    let words_per_sentence = words as f64 / sentences as f64;
    let syllables_per_word = syllables as f64 / words as f64;
    match normalized_language(language) {
        // Adapted Flesch for Polish (Pisarek/Król). Polish syllable density
        // is higher than English, so its coefficient is intentionally lower.
        Some("pl") => (
            (206.835 - 0.65 * words_per_sentence - 62.3 * syllables_per_word).clamp(0.0, 100.0),
            (0.4 * (words_per_sentence + 100.0 * syllables_per_word)).clamp(0.0, 100.0),
            "flesch-pl",
        ),
        Some("es") => (
            (206.84 - 1.02 * words_per_sentence - 60.0 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).clamp(0.0, 100.0),
            "flesch-es",
        ),
        Some("fr") => (
            (207.0 - 1.015 * words_per_sentence - 73.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).clamp(0.0, 100.0),
            "flesch-fr",
        ),
        Some("en") | None => (
            (206.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).clamp(0.0, 100.0),
            "flesch-en",
        ),
        _ => (
            (206.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).max(0.0),
            "flesch-like",
        ),
    }
}

fn content_term_stats(document: &Html, language: Option<&str>) -> Vec<CrawledContentTerm> {
    const STOP_WORDS: &[&str] = &[
        "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "was", "have",
        "has", "will", "into", "about", "our", "their", "they", "what", "when", "where", "which",
        "who", "how", "can", "not", "but", "all", "one", "more", "use", "now", "get", "www",
        "http", "https", "oraz", "jest", "się", "dla", "nie", "jak", "który", "która", "które",
        "przez", "aby", "ten", "tej", "jego", "jej", "czy", "lub", "bez", "nad", "pod", "przy",
        "tym", "także", "może", "mogą", "und", "der", "die", "das", "ein", "eine", "ist", "für",
        "mit", "von", "den", "des", "los", "las", "una", "uno", "para", "por", "con", "que", "del",
        "est", "les", "une", "des", "pour", "avec", "dans", "est", "gli", "che", "una", "per",
        "con", "sono", "della", "uma", "para", "com", "que", "dos", "das", "uma", "как", "это",
        "для", "что", "как", "или", "при", "есть",
    ];
    let normalized_tokens = semantic_content_text(document)
        .split(|character: char| !character.is_alphanumeric())
        .map(str::to_lowercase)
        .collect::<Vec<_>>();
    let total = normalized_tokens.len() as f64;
    let tokens = normalized_tokens
        .into_iter()
        .filter(|token| {
            token.chars().count() >= 3
                && !STOP_WORDS.contains(&token.as_str())
                && !(normalized_language(language) == Some("pl")
                    && matches!(
                        token.as_str(),
                        "te" | "ta"
                            | "to"
                            | "na"
                            | "do"
                            | "od"
                            | "po"
                            | "za"
                            | "ze"
                            | "we"
                            | "w"
                            | "z"
                            | "i"
                            | "że"
                            | "ale"
                            | "więcej"
                            | "czytaj"
                            | "twojej"
                    ))
        })
        .collect::<Vec<_>>();
    if tokens.is_empty() {
        return Vec::new();
    }
    let mut frequencies = HashMap::<String, usize>::new();
    for token in tokens {
        *frequencies.entry(token).or_default() += 1;
    }
    let mut terms = frequencies.into_iter().collect::<Vec<_>>();
    terms.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    terms
        .into_iter()
        .take(20)
        .map(|(term, count)| CrawledContentTerm {
            term,
            count,
            density_percent: count as f64 / total * 100.0,
        })
        .collect()
}

/// Conservative language inference used only when the page omits `html[lang]`.
/// It selects a heuristic but never invents the persisted document language.
fn infer_content_language(text: &str) -> Option<&'static str> {
    const MARKERS: &[(&str, &[&str])] = &[
        ("en", &["the", "and", "with", "from", "this", "that"]),
        (
            "pl",
            &[
                "jest", "oraz", "się", "dla", "który", "które", "może", "mogą",
            ],
        ),
        ("de", &["und", "der", "die", "das", "mit", "nicht", "eine"]),
        (
            "es",
            &["que", "para", "con", "una", "los", "las", "del", "está"],
        ),
        ("fr", &["les", "des", "pour", "avec", "dans", "une", "est"]),
        ("it", &["gli", "che", "una", "per", "con", "sono", "della"]),
        ("pt", &["uma", "para", "com", "que", "dos", "das", "não"]),
        ("ru", &["это", "для", "что", "как", "или", "при", "есть"]),
    ];
    let mut scores = MARKERS
        .iter()
        .map(|(language, _)| (*language, 0usize))
        .collect::<Vec<_>>();
    for token in text
        .split(|character: char| !character.is_alphanumeric())
        .map(str::to_lowercase)
    {
        if token.is_empty() {
            continue;
        }
        for (index, (_, markers)) in MARKERS.iter().enumerate() {
            if markers.contains(&token.as_str()) {
                scores[index].1 += 1;
            }
        }
    }
    scores.sort_by_key(|left| std::cmp::Reverse(left.1));
    let best = scores.first()?;
    let second = scores.get(1).map(|entry| entry.1).unwrap_or(0);
    (best.1 >= 2 && best.1 > second).then_some(best.0)
}

fn phrase_occurrences(text: &str, phrase: &str) -> usize {
    let normalized_phrase = phrase.trim().to_lowercase();
    if normalized_phrase.is_empty() {
        return 0;
    }
    text.to_lowercase()
        .match_indices(&normalized_phrase)
        .count()
}

fn focus_phrase_evidence(
    document: &Html,
    title: Option<&str>,
    meta_description: Option<&str>,
    phrase: Option<&str>,
) -> Option<CrawledFocusPhraseEvidence> {
    let phrase = phrase?.trim();
    if phrase.is_empty() {
        return None;
    }
    let body = semantic_content_text(document);
    let body_occurrences = phrase_occurrences(&body, phrase);
    let token_count = body.split_whitespace().count();
    let title_occurrences = phrase_occurrences(title.unwrap_or_default(), phrase);
    let meta_description_occurrences =
        phrase_occurrences(meta_description.unwrap_or_default(), phrase);
    let h1_selector = Selector::parse("h1").expect("static h1 selector is valid");
    let h1_text = document
        .select(&h1_selector)
        .map(|element| element.text().collect::<Vec<_>>().join(" "))
        .collect::<Vec<_>>()
        .join(" ");
    Some(CrawledFocusPhraseEvidence {
        phrase: phrase.to_string(),
        body_occurrences,
        body_density_percent: if token_count == 0 {
            0.0
        } else {
            body_occurrences as f64 / token_count as f64 * 100.0
        },
        title_occurrences,
        meta_description_occurrences,
        h1_occurrences: phrase_occurrences(&h1_text, phrase),
    })
}

fn content_metrics(document: &Html, html_bytes: usize, language: Option<&str>) -> ContentMetrics {
    let (word_count, content_hash) = normalized_content_fingerprint(document);
    let text = semantic_content_text(document);
    if text.is_empty() {
        return ContentMetrics {
            word_count,
            content_hash,
            text_ratio_percent: (html_bytes > 0).then_some(0.0),
            reading_time_minutes: Some(0),
            ..ContentMetrics::default()
        };
    }
    let effective_language = language.or_else(|| infer_content_language(&text));

    let words = text
        .split_whitespace()
        .map(|token| {
            token
                .chars()
                .filter(|character| character.is_alphanumeric())
                .collect::<String>()
        })
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>();
    let measured_word_count = words.len();
    let sentence_count = text
        .split(['.', '!', '?'])
        .filter(|sentence| sentence.chars().any(char::is_alphanumeric))
        .count();
    let average_words_per_sentence =
        (sentence_count > 0).then_some(measured_word_count as f64 / sentence_count as f64);
    let average_characters_per_word = (measured_word_count > 0).then_some(
        words.iter().map(|word| word.chars().count()).sum::<usize>() as f64
            / measured_word_count as f64,
    );
    let syllable_count = words
        .iter()
        .map(|word| estimate_syllables(word))
        .sum::<usize>();
    let (readability_ease_score, readability_grade, readability_method) =
        if sentence_count > 0 && measured_word_count > 0 {
            let (ease, grade, method) = readability_formula(
                effective_language,
                measured_word_count,
                sentence_count,
                syllable_count,
            );
            (Some(ease), Some(grade), Some(method.to_string()))
        } else {
            (None, None, None)
        };
    let complexity_score = average_words_per_sentence
        .zip(average_characters_per_word)
        .map(|(words_per_sentence, characters_per_word)| {
            let score: f64 = 100.0
                - (words_per_sentence - 12.0).max(0.0) * 3.0
                - (characters_per_word - 5.0).max(0.0) * 8.0;
            score.clamp(0.0, 100.0).round() as u8
        });
    let complexity_label = complexity_score.map(|score| {
        if score >= 75 {
            "simple".to_string()
        } else if score >= 45 {
            "moderate".to_string()
        } else {
            "complex".to_string()
        }
    });
    let readability_label = readability_ease_score.map(readability_label);
    let content_terms = content_term_stats(document, effective_language);

    ContentMetrics {
        word_count,
        content_hash,
        text_ratio_percent: (html_bytes > 0)
            .then_some(((text.len() as f64 / html_bytes as f64) * 100.0).min(100.0)),
        reading_time_minutes: Some(word_count.div_ceil(200)),
        sentence_count: Some(sentence_count),
        average_words_per_sentence,
        average_characters_per_word,
        complexity_score,
        complexity_label,
        readability_ease_score,
        readability_grade,
        readability_method,
        readability_label,
        content_terms,
    }
}

fn semantic_content_root(element: &ElementRef<'_>) -> bool {
    let value = element.value();
    if matches!(value.name(), "main" | "article")
        || value
            .attr("role")
            .is_some_and(|role| role.eq_ignore_ascii_case("main"))
        || value
            .attr("itemprop")
            .is_some_and(|itemprop| itemprop.eq_ignore_ascii_case("articleBody"))
    {
        return true;
    }
    ["id", "class"].iter().any(|attribute| {
        value.attr(attribute).is_some_and(|value| {
            let compact = value
                .chars()
                .filter(|character| character.is_ascii_alphanumeric())
                .collect::<String>()
                .to_ascii_lowercase();
            ["maincontent", "articlebody", "postbody", "entrycontent"]
                .iter()
                .any(|marker| compact.contains(marker))
        })
    })
}

fn semantic_aria_hidden(value: Option<&str>) -> bool {
    value.is_some_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "true" | "1" | "yes"
        )
    })
}

fn semantic_style_hides(value: &str) -> bool {
    value.split(';').any(|declaration| {
        let Some((property, raw_value)) = declaration.split_once(':') else {
            return false;
        };
        let property = property.trim().to_ascii_lowercase();
        let first_value = raw_value
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .trim_end_matches(';')
            .to_ascii_lowercase();
        let first_value = first_value
            .strip_suffix("!important")
            .unwrap_or(&first_value);
        matches!(
            (property.as_str(), first_value),
            ("display", "none") | ("visibility", "hidden") | ("content-visibility", "hidden")
        )
    })
}

fn semantic_chrome_element(element: &ElementRef<'_>) -> bool {
    let value = element.value();
    if matches!(value.name(), "header" | "nav" | "footer" | "aside" | "form")
        || value.attr("hidden").is_some()
        || value.attr("inert").is_some()
        || semantic_aria_hidden(value.attr("aria-hidden"))
        || value.attr("style").is_some_and(semantic_style_hides)
        || value.attr("role").is_some_and(|role| {
            [
                "banner",
                "navigation",
                "contentinfo",
                "complementary",
                "form",
                "search",
            ]
            .iter()
            .any(|candidate| role.eq_ignore_ascii_case(candidate))
        })
    {
        return true;
    }
    ["id", "class"].iter().any(|attribute| {
        value.attr(attribute).is_some_and(|value| {
            value
                .split(|character: char| !character.is_ascii_alphanumeric())
                .map(str::to_ascii_lowercase)
                .any(|token| {
                    [
                        "header",
                        "footer",
                        "sidebar",
                        "side",
                        "navigation",
                        "navbar",
                        "navmenu",
                        "menu",
                        "breadcrumb",
                        "cookie",
                        "consent",
                        "banner",
                    ]
                    .contains(&token.as_str())
                })
        })
    })
}

fn semantic_content_contains(element: &ElementRef<'_>, has_primary_root: bool) -> bool {
    if semantic_chrome_element(element) {
        return false;
    }
    let mut in_primary_root = semantic_content_root(element);
    for ancestor in element.ancestors().filter_map(ElementRef::wrap) {
        if semantic_chrome_element(&ancestor) {
            return false;
        }
        in_primary_root |= semantic_content_root(&ancestor);
    }
    !has_primary_root || in_primary_root
}

/// Return a small, safe source fragment for locating a crawled link in the
/// fetched document. This is evidence, not a copy of the page: values and
/// inline event handlers are redacted and the result is capped by characters.
fn bounded_link_source_excerpt(element: &ElementRef<'_>) -> Option<String> {
    static VALUE_ATTRIBUTE: OnceLock<Regex> = OnceLock::new();
    static EVENT_ATTRIBUTE: OnceLock<Regex> = OnceLock::new();
    let value_attribute = VALUE_ATTRIBUTE.get_or_init(|| {
        Regex::new(r#"(?is)\s+value\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)"#)
            .expect("link value redaction regex is valid")
    });
    let event_attribute = EVENT_ATTRIBUTE.get_or_init(|| {
        Regex::new(r#"(?is)\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)"#)
            .expect("link event redaction regex is valid")
    });
    let compact = element
        .html()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if compact.is_empty() {
        return None;
    }
    let values_redacted = value_attribute.replace_all(&compact, " value=\"[redacted]\"");
    let redacted = event_attribute.replace_all(&values_redacted, " on[redacted]=\"[redacted]\"");
    let excerpt: String = redacted.chars().take(800).collect();
    Some(excerpt)
}

fn has_semantic_content_root(document: &Html) -> bool {
    document
        .root_element()
        .descendants()
        .filter_map(ElementRef::wrap)
        .filter(|element| !semantic_chrome_element(element))
        .any(|element| semantic_content_root(&element))
}

fn semantic_content_source(
    document: &Html,
    is_html: bool,
    body_truncated: bool,
    body_read_failed: bool,
) -> String {
    if !is_html || body_truncated || body_read_failed {
        default_semantic_content_source()
    } else if has_semantic_content_root(document) {
        "primary-root".to_string()
    } else {
        "body-fallback".to_string()
    }
}

fn extract_semantic_terms(document: &Html) -> Vec<String> {
    const STOP_WORDS: &[&str] = &[
        "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "was", "have",
        "has", "will", "into", "about", "our", "their", "they", "what", "when", "where", "which",
        "who", "how", "can", "not", "but", "all", "one", "more", "use", "now", "get", "our",
        "theirs", "www", "http", "https", "oraz", "jest", "się", "dla", "nie", "jak", "który",
        "która", "które", "przez", "oraz", "aby", "ten", "tej", "jego", "jej", "czy", "lub", "bez",
        "nad", "pod", "przy", "tym", "także", "może", "mogą",
    ];
    let body_selector = Selector::parse("body").expect("static body selector is valid");
    let Some(body) = document.select(&body_selector).next() else {
        return Vec::new();
    };
    let has_primary_root = has_semantic_content_root(document);
    let mut frequencies: HashMap<String, usize> = HashMap::new();
    for node in body.descendants() {
        let Node::Text(text) = node.value() else {
            continue;
        };
        let Some(parent) = node.parent().and_then(ElementRef::wrap) else {
            continue;
        };
        if !semantic_content_contains(&parent, has_primary_root)
            || matches!(
                parent.value().name(),
                "script" | "style" | "noscript" | "svg" | "template"
            )
            || parent
                .ancestors()
                .filter_map(ElementRef::wrap)
                .any(|ancestor| {
                    matches!(
                        ancestor.value().name(),
                        "script" | "style" | "noscript" | "svg" | "template"
                    )
                })
        {
            continue;
        }
        for token in text.split(|character: char| !character.is_alphanumeric()) {
            let normalized = token.trim().to_lowercase();
            if normalized.chars().count() >= 3 && !STOP_WORDS.contains(&normalized.as_str()) {
                *frequencies.entry(normalized).or_default() += 1;
            }
        }
    }
    let mut terms = frequencies.into_iter().collect::<Vec<_>>();
    terms.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    terms
        .into_iter()
        .take(MAX_SEMANTIC_TERMS_PER_PAGE)
        .map(|(term, _)| term)
        .collect()
}

fn extract_semantic_excerpts(document: &Html) -> Vec<String> {
    const MAX_CHARS: usize = 240;
    let selector = Selector::parse("p, h1, h2, h3, h4, h5, h6, li, blockquote")
        .expect("static semantic excerpt selector is valid");
    let has_primary_root = has_semantic_content_root(document);
    let mut excerpts = Vec::new();
    let mut seen = HashSet::new();
    for element in document.select(&selector) {
        if !semantic_content_contains(&element, has_primary_root) {
            continue;
        }
        let text = element
            .text()
            .collect::<Vec<_>>()
            .join(" ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        let char_count = text.chars().count();
        if !(24..=MAX_CHARS * 4).contains(&char_count) {
            continue;
        }
        let excerpt = text.chars().take(MAX_CHARS).collect::<String>();
        if seen.insert(excerpt.clone()) {
            excerpts.push(excerpt);
        }
        if excerpts.len() >= MAX_SEMANTIC_EXCERPTS_PER_PAGE {
            break;
        }
    }
    excerpts
}

fn classify_canonical_relation(
    final_url: &str,
    declaration_count: usize,
    canonical_targets: &[String],
) -> &'static str {
    if declaration_count == 0 {
        return "missing";
    }
    if declaration_count > 1 {
        return "multiple";
    }
    let Some(canonical) = canonical_targets.first() else {
        return "invalid";
    };
    let (Some(final_url), Some(canonical_url)) = (
        canonical_identity_url(final_url),
        canonical_identity_url(canonical),
    ) else {
        return "invalid";
    };
    if final_url == canonical_url {
        "self"
    } else if final_url
        .host_str()
        .zip(canonical_url.host_str())
        .is_some_and(|(left, right)| left.eq_ignore_ascii_case(right))
    {
        "same-host-other-url"
    } else {
        "different-host"
    }
}

/// Return a conservative URL identity for canonical comparisons.
///
/// This deliberately does not strip trailing slashes, sort parameters, or
/// remove arbitrary query keys: those choices can be meaningful to a server.
/// It only removes fragments, drops default ports, gives the authority root a
/// stable `/` path, and normalizes unreserved percent escapes.
fn canonical_identity_url(input: &str) -> Option<url::Url> {
    let mut url = url::Url::parse(input).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    url.set_fragment(None);
    if url.path().is_empty() {
        url.set_path("/");
    }
    let default_port = match url.scheme() {
        "http" => Some(80),
        "https" => Some(443),
        _ => None,
    };
    if default_port.is_some_and(|port| url.port() == Some(port)) {
        let _ = url.set_port(None);
    }
    let normalized = canonicalize_unreserved_percent_encoding(url.as_str());
    url::Url::parse(&normalized).ok()
}

fn crawl_canonical_declarations(document: &Html, final_url: &url::Url) -> (usize, Vec<String>) {
    let Ok(selector) = Selector::parse("link[rel]") else {
        return (0, Vec::new());
    };
    let canonical_links = document
        .select(&selector)
        .filter(|element| {
            element.value().attr("rel").is_some_and(|rel| {
                rel.split_ascii_whitespace()
                    .any(|value| value.eq_ignore_ascii_case("canonical"))
            })
        })
        .collect::<Vec<_>>();
    let declaration_count = canonical_links.len();
    let targets = canonical_links
        .iter()
        .filter_map(|element| element.value().attr("href"))
        .map(str::trim)
        .filter(|href| !href.is_empty())
        .filter_map(|href| final_url.join(href).ok())
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(|url| url.to_string())
        .collect();
    (declaration_count, targets)
}

fn pagination_query_changes(source_url: &url::Url, target_url: &url::Url) -> Vec<String> {
    let query_values = |url: &url::Url| {
        url.query_pairs().fold(
            HashMap::<String, Vec<String>>::new(),
            |mut values, (key, value)| {
                values
                    .entry(key.into_owned())
                    .or_default()
                    .push(value.into_owned());
                values
            },
        )
    };
    let source = query_values(source_url);
    let target = query_values(target_url);
    let mut keys = source
        .keys()
        .chain(target.keys())
        .cloned()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    keys.sort();
    keys.into_iter()
        .filter_map(|key| {
            let old = source.get(&key);
            let new = target.get(&key);
            (old != new).then(|| {
                format!(
                    "{key}: {} → {}",
                    old.map(|values| values.join(", "))
                        .unwrap_or_else(|| "∅".into()),
                    new.map(|values| values.join(", "))
                        .unwrap_or_else(|| "∅".into())
                )
            })
        })
        .collect()
}

fn crawl_pagination_links(
    document: &Html,
    final_url: &url::Url,
) -> (Vec<CrawledPaginationLink>, usize, usize) {
    // HTML allows pagination relations on both metadata links and ordinary
    // navigational anchors. Search engines and real sites use both forms;
    // restricting this to `link[rel]` silently dropped valid `<a rel=next>`
    // declarations from the crawl evidence.
    let Ok(selector) = Selector::parse("link[rel], a[rel]") else {
        return (Vec::new(), 0, 0);
    };
    let mut links = Vec::new();
    let mut declaration_count = 0;
    let mut invalid_declaration_count = 0;
    for element in document.select(&selector) {
        let Some(rel) = element.value().attr("rel") else {
            continue;
        };
        for relation in rel.split_ascii_whitespace().filter(|value| {
            value.eq_ignore_ascii_case("next") || value.eq_ignore_ascii_case("prev")
        }) {
            declaration_count += 1;
            let target = element
                .value()
                .attr("href")
                .map(str::trim)
                .filter(|href| !href.is_empty())
                .and_then(|href| final_url.join(href).ok())
                .filter(|url| matches!(url.scheme(), "http" | "https"));
            let Some(target) = target else {
                invalid_declaration_count += 1;
                continue;
            };
            links.push(CrawledPaginationLink {
                relation: relation.to_ascii_lowercase(),
                query_parameter_changes: pagination_query_changes(final_url, &target),
                target_url: target.to_string(),
                http_status: None,
                checked_in_run: false,
                reciprocal_in_run: None,
            });
        }
    }
    (links, declaration_count, invalid_declaration_count)
}

fn pagination_canonical_alignment(canonical_relation: &str) -> Option<String> {
    let alignment = match canonical_relation {
        "self" => "self-canonical",
        "missing" => "missing-canonical",
        "multiple" => "multiple-canonical",
        "invalid" => "invalid-canonical",
        "unavailable" => return None,
        _ => "canonical-points-elsewhere",
    };
    Some(alignment.into())
}

fn duplicate_text_indices<'a>(
    values: impl IntoIterator<Item = Option<&'a str>>,
) -> Vec<Vec<usize>> {
    let mut indexes: HashMap<String, Vec<usize>> = HashMap::new();
    for (index, value) in values.into_iter().enumerate() {
        if let Some(normalized) = value.map(str::trim).filter(|value| !value.is_empty()) {
            indexes
                .entry(normalized.to_lowercase())
                .or_default()
                .push(index);
        }
    }
    indexes
        .into_values()
        .filter(|group| group.len() > 1)
        .collect()
}

fn verify_canonical_target(
    target: &mut CrawledCanonicalTarget,
    crawled_statuses: &HashMap<String, u16>,
) -> Option<u16> {
    let status = crawled_statuses.get(&target.url).copied()?;
    target.http_status = Some(status);
    target.checked_in_run = true;
    Some(status)
}

fn verify_pagination_target(
    target: &mut CrawledPaginationLink,
    crawled_statuses: &HashMap<String, u16>,
) -> Option<u16> {
    let status = crawled_statuses.get(&target.target_url).copied()?;
    target.http_status = Some(status);
    target.checked_in_run = true;
    Some(status)
}

fn opposite_pagination_relation(relation: &str) -> Option<&'static str> {
    match relation.to_ascii_lowercase().as_str() {
        "next" => Some("prev"),
        "prev" => Some("next"),
        _ => None,
    }
}

/// Build a bounded identity graph for pagination declarations. Both the
/// requested and final URL are accepted as a page identity so redirects do
/// not erase a reciprocal edge.
fn pagination_edges(pages: &[CrawledPageSummary]) -> HashSet<(String, String, String)> {
    let mut edges = HashSet::new();
    for page in pages {
        let source_keys = [page.url.as_str(), page.final_url.as_str()]
            .into_iter()
            .filter_map(canonical_identity_url)
            .map(|url| url.to_string())
            .collect::<Vec<_>>();
        for link in &page.pagination_links {
            let Some(target) = canonical_identity_url(&link.target_url).map(|url| url.to_string())
            else {
                continue;
            };
            let relation = link.relation.to_ascii_lowercase();
            for source in &source_keys {
                edges.insert((source.clone(), relation.clone(), target.clone()));
            }
        }
    }
    edges
}

fn verify_amp_target(
    source_url: &str,
    source_final_url: &str,
    target_url: &str,
    crawled_statuses: &HashMap<String, u16>,
    canonical_targets: &HashMap<String, Option<String>>,
) -> (Option<u16>, Option<String>) {
    let Some(status) = crawled_statuses.get(target_url).copied() else {
        return (None, None);
    };
    let Some(canonical) = canonical_targets.get(target_url) else {
        return (Some(status), None);
    };
    let alignment = match canonical {
        Some(canonical)
            if same_hreflang_url(canonical, source_url)
                || same_hreflang_url(canonical, source_final_url) =>
        {
            "canonical-to-source"
        }
        Some(canonical) if same_hreflang_url(canonical, target_url) => "self-canonical",
        Some(_) => "canonical-points-elsewhere",
        None => "missing-canonical",
    };
    (Some(status), Some(alignment.into()))
}

fn parse_client_redirect(
    source: &str,
    declaration: &str,
    base_url: &url::Url,
) -> CrawledClientRedirect {
    let (delay, destination) = declaration
        .split_once(';')
        .map(|(delay, destination)| (delay.trim(), Some(destination.trim())))
        .unwrap_or((declaration.trim(), None));
    let delay_seconds = delay
        .parse::<f64>()
        .ok()
        .filter(|seconds| seconds.is_finite() && *seconds >= 0.0);
    let target_url = destination
        .and_then(|value| value.split_once('='))
        .filter(|(key, _)| key.trim().eq_ignore_ascii_case("url"))
        .map(|(_, value)| value.trim().trim_matches(['\"', '\'']))
        .filter(|value| !value.is_empty())
        .and_then(|value| base_url.join(value).ok())
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(|url| url.to_string());
    CrawledClientRedirect {
        source: source.into(),
        declaration: declaration.into(),
        delay_seconds,
        target_url,
    }
}

/// Extract only literal JavaScript navigations from inline scripts.
///
/// This is intentionally static evidence: scripts are never executed, dynamic
/// expressions are not guessed, and non-JavaScript script types (JSON-LD,
/// import maps, templates) are ignored. The bounded result keeps a hostile
/// page from inflating one URL's redirect inventory.
fn extract_javascript_redirects(
    document: &Html,
    base_url: &url::Url,
) -> Vec<CrawledClientRedirect> {
    const MAX_REDIRECTS_PER_PAGE: usize = 32;
    let Ok(script_selector) = Selector::parse("script:not([src])") else {
        return Vec::new();
    };
    let Ok(event_selector) = Selector::parse(
        "*[onclick],*[onload],*[onbeforeunload],*[onunload],*[onpageshow],*[onpopstate]",
    ) else {
        return Vec::new();
    };
    // Rust's regex engine intentionally does not support backreferences, so
    // keep the quote-delimited and template-literal patterns separate. A
    // template literal is accepted only when it has no interpolation; this is
    // static evidence and never evaluates JavaScript expressions.
    let assignment = Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location(?:\.href)?\s*=\s*(['\"])([^'\"]{1,2048})['\"]"#,
    )
    .expect("javascript location assignment pattern is valid");
    let assignment_template = Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location(?:\.href)?\s*=\s*`([^`$]{1,2048})`"#,
    )
    .expect("javascript template location assignment pattern is valid");
    let call = Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location\.(?:replace|assign)\s*\(\s*(['\"])([^'\"]{1,2048})['\"]\s*\)"#,
    )
    .expect("javascript location call pattern is valid");
    let call_template = Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location\.(?:replace|assign)\s*\(\s*`([^`$]{1,2048})`\s*\)"#,
    )
    .expect("javascript template location call pattern is valid");
    let mut redirects = Vec::new();
    let mut seen = HashSet::new();

    let mut scan_source = |source: &str, evidence_source: &str| {
        if redirects.len() >= MAX_REDIRECTS_PER_PAGE {
            return;
        }
        for captures in [&assignment, &call] {
            for matched in captures.captures_iter(source) {
                let Some(full) = matched.get(0).map(|value| value.as_str().trim()) else {
                    continue;
                };
                let Some(target) = matched.get(2).map(|value| value.as_str().trim()) else {
                    continue;
                };
                let target_url = base_url
                    .join(target)
                    .ok()
                    .filter(|url| matches!(url.scheme(), "http" | "https"))
                    .map(|url| url.to_string());
                let dedupe_key = format!("{evidence_source}\u{1f}{full}\u{1f}{target_url:?}");
                if seen.insert(dedupe_key) {
                    redirects.push(CrawledClientRedirect {
                        source: evidence_source.into(),
                        declaration: full.chars().take(2048).collect(),
                        delay_seconds: None,
                        target_url,
                    });
                    if redirects.len() >= MAX_REDIRECTS_PER_PAGE {
                        return;
                    }
                }
            }
        }
        for captures in [&assignment_template, &call_template] {
            for matched in captures.captures_iter(source) {
                let Some(full) = matched.get(0).map(|value| value.as_str().trim()) else {
                    continue;
                };
                let Some(target) = matched.get(1).map(|value| value.as_str().trim()) else {
                    continue;
                };
                let target_url = base_url
                    .join(target)
                    .ok()
                    .filter(|url| matches!(url.scheme(), "http" | "https"))
                    .map(|url| url.to_string());
                let dedupe_key = format!("{evidence_source}\u{1f}{full}\u{1f}{target_url:?}");
                if seen.insert(dedupe_key) {
                    redirects.push(CrawledClientRedirect {
                        source: evidence_source.into(),
                        declaration: full.chars().take(2048).collect(),
                        delay_seconds: None,
                        target_url,
                    });
                    if redirects.len() >= MAX_REDIRECTS_PER_PAGE {
                        return;
                    }
                }
            }
        }
    };

    for script in document.select(&script_selector) {
        if let Some(script_type) = script.value().attr("type") {
            let normalized = script_type.trim().to_ascii_lowercase();
            if !normalized.is_empty()
                && !normalized.contains("javascript")
                && !normalized.contains("ecmascript")
                && normalized != "module"
            {
                continue;
            }
        }
        let source = script.text().collect::<String>();
        scan_source(&source, "javascript");
    }

    for element in document.select(&event_selector) {
        for (name, value) in element.value().attrs() {
            if name.starts_with("on") {
                scan_source(value, "javascript-inline");
            }
        }
    }
    redirects
}

fn crawl_social_metadata(
    document: &Html,
    base_url: &url::Url,
) -> (Vec<String>, Vec<CrawledSocialMetaTag>) {
    let Ok(link_selector) = Selector::parse("link[rel][href]") else {
        return (Vec::new(), Vec::new());
    };
    let Ok(meta_selector) = Selector::parse("meta[property], meta[name]") else {
        return (Vec::new(), Vec::new());
    };

    let mut favicons = Vec::new();
    for element in document.select(&link_selector) {
        let rel_tokens = element
            .value()
            .attr("rel")
            .unwrap_or_default()
            .split_ascii_whitespace()
            .map(str::to_ascii_lowercase)
            .collect::<HashSet<_>>();
        let is_icon = rel_tokens.contains("icon")
            || rel_tokens.contains("apple-touch-icon")
            || rel_tokens.contains("mask-icon");
        if !is_icon {
            continue;
        }
        let Some(href) = element
            .value()
            .attr("href")
            .map(str::trim)
            .filter(|href| !href.is_empty())
        else {
            continue;
        };
        let Some(icon_url) = base_url
            .join(href)
            .ok()
            .filter(|url| matches!(url.scheme(), "http" | "https"))
            .map(|url| url.to_string())
        else {
            continue;
        };
        if !favicons.contains(&icon_url) {
            favicons.push(icon_url);
        }
    }

    let social_meta_tags = document
        .select(&meta_selector)
        .flat_map(|element| {
            let value = element.value();
            [value.attr("property"), value.attr("name")]
                .into_iter()
                .flatten()
                .filter_map(|attribute| {
                    let key = attribute.trim().to_ascii_lowercase();
                    if !key.starts_with("og:") && !key.starts_with("twitter:") {
                        return None;
                    }
                    let content = value
                        .attr("content")
                        .map(str::trim)
                        .map(str::to_owned)
                        .map(|content| resolve_social_metadata_url(&key, content, base_url));
                    let resource_check = is_social_image_meta_key(&key)
                        .then_some(content.as_deref())
                        .flatten()
                        .filter(|url| matches!(url::Url::parse(url), Ok(parsed) if matches!(parsed.scheme(), "http" | "https")))
                        .map(unchecked_social_resource);
                    Some(CrawledSocialMetaTag {
                        key,
                        content,
                        resource_check,
                    })
                })
        })
        .collect();

    (favicons, social_meta_tags)
}

/// Extract the same favicon declaration metadata as the single-page audit,
/// while keeping this crawler's legacy URL list stable for persisted runs.
fn crawl_favicon_metadata(document: &Html, base_url: &url::Url) -> Vec<FaviconData> {
    let Ok(selector) = Selector::parse("link[rel][href]") else {
        return Vec::new();
    };
    document
        .select(&selector)
        .filter_map(|element| {
            let value = element.value();
            let rel = value.attr("rel")?.trim();
            let rel_lower = rel.to_ascii_lowercase();
            if !rel_lower.split_ascii_whitespace().any(|token| {
                matches!(
                    token,
                    "icon" | "shortcut" | "apple-touch-icon" | "mask-icon"
                )
            }) {
                return None;
            }
            let raw_href = value.attr("href")?.trim();
            if raw_href.is_empty() {
                return None;
            }
            let resolved = if raw_href.to_ascii_lowercase().starts_with("data:image/") {
                bounded_inline_image_uri(raw_href)
            } else {
                base_url
                    .join(raw_href)
                    .ok()
                    .filter(|url| matches!(url.scheme(), "http" | "https"))?
                    .to_string()
            };
            let clean_path = resolved
                .split('?')
                .next()
                .unwrap_or(&resolved)
                .split('#')
                .next()
                .unwrap_or(&resolved)
                .to_ascii_lowercase();
            let inferred_format = if clean_path.starts_with("data:image/") {
                clean_path
                    .trim_start_matches("data:image/")
                    .split([';', ','])
                    .next()
                    .filter(|format| !format.is_empty())
                    .map(str::to_string)
            } else {
                clean_path
                    .rsplit('.')
                    .next()
                    .filter(|extension| *extension != clean_path)
                    .map(str::to_string)
            };
            Some(FaviconData {
                href: resolved,
                rel: rel.to_string(),
                declared_type: value
                    .attr("type")
                    .map(str::trim)
                    .filter(|item| !item.is_empty())
                    .map(str::to_string),
                declared_sizes: value
                    .attr("sizes")
                    .map(str::trim)
                    .filter(|item| !item.is_empty())
                    .map(str::to_string),
                inferred_format,
            })
        })
        .fold(Vec::new(), |mut unique, favicon| {
            if !unique.iter().any(|existing: &FaviconData| {
                existing.href == favicon.href && existing.rel == favicon.rel
            }) {
                unique.push(favicon);
            }
            unique
        })
}

fn crawl_frames(document: &Html, base_url: &url::Url) -> (Vec<CrawledFrame>, bool) {
    let Ok(selector) = Selector::parse("iframe") else {
        return (Vec::new(), false);
    };
    let mut frames = Vec::new();
    let mut truncated = false;
    for element in document.select(&selector) {
        if frames.len() >= MAX_IFRAMES_PER_PAGE {
            truncated = true;
            break;
        }
        let value = element.value();
        let src = value.attr("src").map(str::to_owned);
        let resolved_url = src
            .as_deref()
            .map(str::trim)
            .filter(|src| !src.is_empty())
            .and_then(|src| base_url.join(src).ok())
            .filter(|url| matches!(url.scheme(), "http" | "https"))
            .map(|url| url.to_string());
        frames.push(CrawledFrame {
            src,
            resolved_url,
            title: value.attr("title").map(str::to_owned),
            name: value.attr("name").map(str::to_owned),
            loading: value.attr("loading").map(str::to_owned),
            sandbox: value.attr("sandbox").map(str::to_owned),
            checked_in_run: false,
            http_status: None,
            request_error_kind: None,
        });
    }
    (frames, truncated)
}

fn resolve_social_metadata_url(key: &str, content: String, base_url: &url::Url) -> String {
    let is_url = matches!(
        key,
        "og:url"
            | "og:image"
            | "og:image:url"
            | "og:image:secure_url"
            | "og:audio"
            | "og:video"
            | "twitter:image"
            | "twitter:image:src"
    );
    if !is_url {
        return content;
    }
    base_url
        .join(&content)
        .ok()
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(|url| url.to_string())
        .unwrap_or(content)
}

fn is_social_image_meta_key(key: &str) -> bool {
    matches!(
        key,
        "og:image" | "og:image:url" | "og:image:secure_url" | "twitter:image" | "twitter:image:src"
    )
}

fn unchecked_social_resource(url: &str) -> CrawledSocialResourceCheck {
    CrawledSocialResourceCheck {
        url: url.to_owned(),
        checked_in_run: false,
        http_status: None,
        content_type: None,
        content_length: None,
        intrinsic_width: None,
        intrinsic_height: None,
        dimensions_source: None,
        request_error_kind: None,
    }
}

fn collect_json_ld_types(value: &serde_json::Value, types: &mut Vec<String>) {
    match value {
        serde_json::Value::Array(items) => items
            .iter()
            .for_each(|item| collect_json_ld_types(item, types)),
        serde_json::Value::Object(map) => {
            if let Some(value) = map.get("@type") {
                match value {
                    serde_json::Value::String(value) => types.push(value.to_string()),
                    serde_json::Value::Array(values) => values
                        .iter()
                        .filter_map(|value| value.as_str())
                        .for_each(|value| types.push(value.to_string())),
                    _ => {}
                }
            }
            if let Some(graph) = map.get("@graph") {
                collect_json_ld_types(graph, types);
            }
        }
        _ => {}
    }
}

fn append_schema_findings(
    findings: Vec<StructuredDataValidationIssue>,
    format: &str,
    declaration_index: usize,
    output: &mut Vec<CrawledSchemaFinding>,
    truncated: &mut bool,
) {
    for finding in findings {
        if output.len() >= MAX_SCHEMA_FINDINGS_PER_PAGE {
            *truncated = true;
            break;
        }
        output.push(CrawledSchemaFinding {
            format: format.to_string(),
            declaration_index,
            finding,
        });
    }
}

fn push_schema_reference(
    references: &mut Vec<CrawledSchemaReference>,
    format: &str,
    declaration_index: usize,
    property: &str,
    value: &str,
) {
    if references.len() >= MAX_SCHEMA_REFERENCES_PER_PAGE {
        return;
    }
    let property = property.trim();
    let value = value.trim();
    if property.is_empty()
        || value.is_empty()
        || value.chars().count() > MAX_SCHEMA_REFERENCE_VALUE_CHARS
    {
        return;
    }
    if value.chars().any(char::is_control) {
        return;
    }
    let candidate = CrawledSchemaReference {
        format: format.to_string(),
        declaration_index,
        property: property.to_string(),
        value: value.to_string(),
    };
    if !references.iter().any(|reference| reference == &candidate) {
        references.push(candidate);
    }
}

fn collect_json_ld_references(
    value: &serde_json::Value,
    declaration_index: usize,
    references: &mut Vec<CrawledSchemaReference>,
    depth: usize,
) {
    if depth > 16 || references.len() >= MAX_SCHEMA_REFERENCES_PER_PAGE {
        return;
    }
    const REFERENCE_PROPERTIES: &[&str] = &[
        "@id",
        "url",
        "sameAs",
        "mainEntityOfPage",
        "isPartOf",
        "about",
        "subjectOf",
        "author",
        "publisher",
        "image",
        "logo",
    ];
    match value {
        serde_json::Value::Array(values) => values.iter().for_each(|item| {
            collect_json_ld_references(item, declaration_index, references, depth + 1)
        }),
        serde_json::Value::Object(map) => {
            for (property, nested) in map {
                if REFERENCE_PROPERTIES.contains(&property.as_str()) {
                    match nested {
                        serde_json::Value::String(value) => push_schema_reference(
                            references,
                            "JSON-LD",
                            declaration_index,
                            property,
                            value,
                        ),
                        serde_json::Value::Array(values) => values.iter().for_each(|item| {
                            if let serde_json::Value::String(value) = item {
                                push_schema_reference(
                                    references,
                                    "JSON-LD",
                                    declaration_index,
                                    property,
                                    value,
                                );
                            }
                        }),
                        _ => {}
                    }
                }
                collect_json_ld_references(nested, declaration_index, references, depth + 1);
                if references.len() >= MAX_SCHEMA_REFERENCES_PER_PAGE {
                    break;
                }
            }
        }
        _ => {}
    }
}

fn inspect_page_schema(
    document: &Html,
) -> (
    Vec<String>,
    usize,
    Vec<CrawledSchemaFinding>,
    Vec<CrawledSchemaReference>,
    bool,
) {
    let json_ld_selector = Selector::parse("script[type='application/ld+json']").unwrap();
    let microdata_selector = Selector::parse("[itemscope]").unwrap();
    let itemprop_selector = Selector::parse("[itemprop]").unwrap();
    let rdfa_selector = Selector::parse(
        "[typeof], [property], [vocab], [about], [resource], [property][href], [property][src], [rel][resource]",
    )
    .unwrap();
    let mut schema_types = Vec::new();
    let mut schema_references = Vec::new();
    let mut syntax_errors = 0;
    let mut findings = Vec::new();
    let mut truncated = false;

    let jsonld_blocks = document.select(&json_ld_selector).collect::<Vec<_>>();
    for (index, element) in jsonld_blocks
        .iter()
        .take(MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .enumerate()
    {
        let raw = element.text().collect::<String>();
        match serde_json::from_str::<serde_json::Value>(&raw) {
            Ok(value) => {
                collect_json_ld_types(&value, &mut schema_types);
                collect_json_ld_references(&value, index + 1, &mut schema_references, 0);
                append_schema_findings(
                    schema_validator::validate_jsonld(&value),
                    "JSON-LD",
                    index + 1,
                    &mut findings,
                    &mut truncated,
                );
            }
            Err(error) => {
                syntax_errors += 1;
                append_schema_findings(
                    vec![StructuredDataValidationIssue {
                        code: "jsonld-syntax-invalid".into(),
                        severity: "error".into(),
                        message: format!("JSON-LD could not be parsed: {error}"),
                        path: None,
                        recommendation: Some(
                            "Fix the JSON syntax in this script[type=application/ld+json] block."
                                .into(),
                        ),
                    }],
                    "JSON-LD",
                    index + 1,
                    &mut findings,
                    &mut truncated,
                );
            }
        }
    }
    if jsonld_blocks.len() > MAX_SCHEMA_DECLARATIONS_PER_PAGE {
        truncated = true;
    }

    let microdata_items = document.select(&microdata_selector).collect::<Vec<_>>();
    for (index, element) in microdata_items
        .iter()
        .take(MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .enumerate()
    {
        let itemprops = element
            .select(&itemprop_selector)
            .flat_map(|property| {
                property
                    .value()
                    .attr("itemprop")
                    .unwrap_or_default()
                    .split_ascii_whitespace()
                    .map(str::to_owned)
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        let itemtype = element.value().attr("itemtype").map(str::trim);
        if let Some(itemtype) = itemtype {
            schema_types.extend(itemtype.split_ascii_whitespace().map(str::to_owned));
        }
        if let Some(itemid) = element.value().attr("itemid") {
            push_schema_reference(
                &mut schema_references,
                "Microdata",
                index + 1,
                "itemid",
                itemid,
            );
        }
        if let Some(itemref) = element.value().attr("itemref") {
            for target in itemref.split_ascii_whitespace() {
                push_schema_reference(
                    &mut schema_references,
                    "Microdata",
                    index + 1,
                    "itemref",
                    target,
                );
            }
        }
        let value = serde_json::json!({ "itemtype": itemtype, "itemprops": itemprops });
        append_schema_findings(
            schema_validator::validate_microdata(&value),
            "Microdata",
            index + 1,
            &mut findings,
            &mut truncated,
        );
    }
    if microdata_items.len() > MAX_SCHEMA_DECLARATIONS_PER_PAGE {
        truncated = true;
    }

    let rdfa_nodes = document.select(&rdfa_selector).collect::<Vec<_>>();
    for (index, element) in rdfa_nodes
        .iter()
        .take(MAX_SCHEMA_DECLARATIONS_PER_PAGE)
        .enumerate()
    {
        let typeof_value = element.value().attr("typeof").map(str::trim);
        if let Some(typeof_value) = typeof_value {
            schema_types.extend(typeof_value.split_ascii_whitespace().map(str::to_owned));
        }
        let value = serde_json::json!({
            "typeof": typeof_value,
            "property": element.value().attr("property").map(str::trim),
            "vocab": element.value().attr("vocab").map(str::trim),
            "about": element.value().attr("about"),
            "resource": element.value().attr("resource"),
        });
        let relation_property = element
            .value()
            .attr("property")
            .or_else(|| element.value().attr("rel"))
            .unwrap_or("@resource");
        for attribute in ["resource", "href", "src", "about"] {
            if let Some(target) = element.value().attr(attribute) {
                push_schema_reference(
                    &mut schema_references,
                    "RDFa",
                    index + 1,
                    relation_property,
                    target,
                );
            }
        }
        append_schema_findings(
            schema_validator::validate_rdfa(&value),
            "RDFa",
            index + 1,
            &mut findings,
            &mut truncated,
        );
    }
    if rdfa_nodes.len() > MAX_SCHEMA_DECLARATIONS_PER_PAGE {
        truncated = true;
    }

    schema_types.sort();
    schema_types.dedup();
    if truncated && findings.len() < MAX_SCHEMA_FINDINGS_PER_PAGE {
        findings.push(CrawledSchemaFinding {
            format: "Local validation".into(),
            declaration_index: 0,
            finding: StructuredDataValidationIssue {
                code: "schema-validation-truncated".into(),
                severity: "info".into(),
                message: "Structured-data validation was capped by per-page safety limits.".into(),
                path: None,
                recommendation: Some(
                    "Review declarations omitted after the local safety limit in the source page."
                        .into(),
                ),
            },
        });
    }
    schema_references.sort_by(|left, right| {
        left.format
            .cmp(&right.format)
            .then(left.declaration_index.cmp(&right.declaration_index))
            .then(left.property.cmp(&right.property))
            .then(left.value.cmp(&right.value))
    });
    (
        schema_types,
        syntax_errors,
        findings,
        schema_references,
        truncated,
    )
}

fn redirect_target_is_new(seen: &mut HashSet<String>, target: &str) -> bool {
    seen.insert(target.to_string())
}

fn classify_request_error(is_timeout: bool, is_connect: bool, detail: &str) -> &'static str {
    let detail = detail.to_ascii_lowercase();
    if is_timeout
        || detail.contains("timed out")
        || detail.contains("timeout")
        || detail.contains("deadline has elapsed")
    {
        return "timeout";
    }
    // DNS and TLS failures are often wrapped by reqwest as a generic connect
    // error. Inspect the full source-chain text before falling back to the
    // broad connect bucket so the UI and CSV retain the useful root cause.
    if detail.contains("dns")
        || detail.contains("name or service not known")
        || detail.contains("temporary failure in name resolution")
        || detail.contains("failed to lookup address")
        || detail.contains("could not resolve host")
        || detail.contains("nodename nor servname")
        || detail.contains("no such host")
    {
        return "dns";
    }
    if detail.contains("tls")
        || detail.contains("certificate")
        || detail.contains("unknown ca")
        || detail.contains("invalid peer certificate")
        || detail.contains("handshake failure")
        || detail.contains("rustls")
        || detail.contains("native-tls")
    {
        return "tls";
    }
    if is_connect
        || detail.contains("connection refused")
        || detail.contains("connection reset")
        || detail.contains("connection aborted")
        || detail.contains("failed to connect")
        || detail.contains("connect error")
        || detail.contains("network is unreachable")
    {
        return "connect";
    }
    "network"
}

fn request_error_kind(error: &reqwest::Error) -> String {
    let mut detail = error.to_string();
    let mut source = error.source();
    while let Some(cause) = source {
        detail.push_str(" | ");
        detail.push_str(&cause.to_string());
        source = cause.source();
    }
    classify_request_error(error.is_timeout(), error.is_connect(), &detail).into()
}

fn crawl_deadline_reached(start_time: Instant, max_run_seconds: Option<u64>) -> bool {
    max_run_seconds
        .is_some_and(|seconds| start_time.elapsed() >= std::time::Duration::from_secs(seconds))
}

#[allow(clippy::too_many_arguments)]
async fn request_with_safe_redirects(
    client: &reqwest::Client,
    initial_url: &str,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
    allowed_hosts: &[String],
    max_redirects: usize,
    config: &CrawlConfig,
) -> Result<FetchedResponse, reqwest::Error> {
    let mut requested_url = initial_url.to_string();
    let mut chain = Vec::new();
    let mut seen_targets = HashSet::from([requested_url.clone()]);
    loop {
        let request_started_at = Instant::now();
        let response = client.get(&requested_url).send().await?;
        let response_time_ms = request_started_at.elapsed().as_millis() as u64;
        let status = response.status().as_u16();
        if !(300..400).contains(&status) {
            return Ok(FetchedResponse {
                response: FetchedPageBody::Http(response),
                final_url: requested_url,
                redirect_chain: chain,
                redirect_stopped_reason: None,
            });
        }
        let Some(location) = response
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|value| value.to_str().ok())
        else {
            return Ok(FetchedResponse {
                response: FetchedPageBody::Http(response),
                final_url: requested_url,
                redirect_chain: chain,
                redirect_stopped_reason: Some(
                    "Redirect response has no valid Location header".into(),
                ),
            });
        };
        let next = match url::Url::parse(&requested_url)
            .ok()
            .and_then(|base| base.join(location).ok())
        {
            Some(url) => url,
            None => {
                return Ok(FetchedResponse {
                    response: FetchedPageBody::Http(response),
                    final_url: requested_url,
                    redirect_chain: chain,
                    redirect_stopped_reason: Some("Redirect Location cannot be resolved".into()),
                })
            }
        };
        let validated = match validate_and_normalize_url(next.as_str()) {
            Ok(url)
                if matches_scope(&url, base_host, allow_subdomains, scope_path, allowed_hosts) =>
            {
                url
            }
            Ok(_) => {
                return Ok(FetchedResponse {
                    response: FetchedPageBody::Http(response),
                    final_url: requested_url,
                    redirect_chain: chain,
                    redirect_stopped_reason: Some(
                        "Redirect target is outside the configured crawl scope".into(),
                    ),
                })
            }
            Err(error) => {
                return Ok(FetchedResponse {
                    response: FetchedPageBody::Http(response),
                    final_url: requested_url,
                    redirect_chain: chain,
                    redirect_stopped_reason: Some(format!("Redirect target was rejected: {error}")),
                })
            }
        };
        let normalized = normalize_crawl_url(validated, config);
        chain.push(CrawledRedirectHop {
            from_url: requested_url.clone(),
            http_status: status,
            to_url: normalized.to_string(),
            response_time_ms: Some(response_time_ms),
        });
        if !redirect_target_is_new(&mut seen_targets, normalized.as_str()) {
            return Ok(FetchedResponse {
                response: FetchedPageBody::Http(response),
                final_url: requested_url,
                redirect_chain: chain,
                redirect_stopped_reason: Some(
                    "Redirect loop detected; the repeated target was not requested again".into(),
                ),
            });
        }
        if chain.len() > max_redirects {
            return Ok(FetchedResponse {
                response: FetchedPageBody::Http(response),
                final_url: requested_url,
                redirect_chain: chain,
                redirect_stopped_reason: Some(format!(
                    "Redirect limit of {max_redirects} exceeded"
                )),
            });
        }
        requested_url = normalized.to_string();
    }
}

/// Fetch a bounded window of HTML pages concurrently while keeping parsing and
/// queue expansion deterministic. Resource requests already use this pattern;
/// the same window is safe for HTML only when robots crawl-delay is absent.
#[allow(clippy::too_many_arguments)]
async fn prefetch_http_pages(
    queue: &mut VecDeque<(String, usize)>,
    prefetched_order: &mut VecDeque<(String, usize)>,
    prefetched_responses: &mut HashMap<String, Result<FetchedResponse, CrawlFetchFailure>>,
    max_concurrent_requests: usize,
    max_pages: usize,
    completed_pages: usize,
    client: &reqwest::Client,
    base_host: &str,
    allow_subdomains: bool,
    scope_path: Option<&str>,
    allowed_hosts: &[String],
    max_redirects: usize,
    config: &CrawlConfig,
    robots_rules: &[RobotsRule],
) {
    let slots = max_concurrent_requests
        .min(max_pages.saturating_sub(completed_pages + prefetched_order.len()));
    if slots < 2 || queue.is_empty() {
        return;
    }

    let mut candidates = Vec::with_capacity(slots);
    for _ in 0..slots {
        let Some((url, depth)) = queue.pop_front() else {
            break;
        };
        prefetched_order.push_back((url.clone(), depth));
        if config.respect_robots
            && url::Url::parse(&url)
                .ok()
                .is_some_and(|parsed| !robots_allows(&parsed, robots_rules))
        {
            // Leave disallowed pages in the ordered work list. The main loop
            // records the exact robots rule instead of turning it into a
            // synthetic transport error.
            continue;
        }
        candidates.push((url, depth));
    }

    let mut tasks = JoinSet::new();
    for (url, _depth) in candidates {
        let client = client.clone();
        let base_host = base_host.to_owned();
        let scope_path = scope_path.map(str::to_owned);
        let allowed_hosts = allowed_hosts.to_vec();
        let config = config.clone();
        let max_response_bytes = config
            .max_response_bytes
            .unwrap_or(5_000_000)
            .clamp(1_024, 50_000_000);
        tasks.spawn(async move {
            let result = request_with_safe_redirects(
                &client,
                &url,
                &base_host,
                allow_subdomains,
                scope_path.as_deref(),
                &allowed_hosts,
                max_redirects,
                &config,
            )
            .await
            .map_err(|error| CrawlFetchFailure {
                kind: request_error_kind(&error),
                message: error.to_string(),
            });
            let result = match result {
                Ok(mut fetched) => {
                    if let FetchedPageBody::Http(response) = fetched.response {
                        let data = read_fetched_page_data(
                            FetchedPageBody::Http(response),
                            max_response_bytes,
                        )
                        .await;
                        fetched.response = FetchedPageBody::Prefetched(Box::new(data));
                    }
                    Ok(fetched)
                }
                Err(error) => Err(error),
            };
            (url, result)
        });
    }

    while let Some(joined) = tasks.join_next().await {
        match joined {
            Ok((url, result)) => {
                prefetched_responses.insert(url, result);
            }
            Err(error) => {
                // A task panic should remain visible as a page-level failure,
                // not silently remove a URL from the ordered queue.
                if let Some((url, _)) = prefetched_order
                    .iter()
                    .find(|(candidate, _)| !prefetched_responses.contains_key(candidate))
                {
                    prefetched_responses.insert(
                        url.clone(),
                        Err(CrawlFetchFailure {
                            kind: "prefetch_task".into(),
                            message: error.to_string(),
                        }),
                    );
                }
            }
        }
    }
}

#[tauri::command]
pub fn cancel_site_crawl(run_id: String, control: State<'_, CrawlControl>) -> Result<(), String> {
    control
        .cancelled_runs
        .lock()
        .map_err(|_| "Crawler cancellation state is unavailable.".to_string())?
        .insert(run_id);
    Ok(())
}

#[tauri::command]
pub fn pause_site_crawl(run_id: String, control: State<'_, CrawlControl>) -> Result<(), String> {
    if control.is_cancelled(&run_id) {
        return Err("Cannot pause a cancelled crawl.".into());
    }
    control.pause(&run_id);
    Ok(())
}

#[tauri::command]
pub fn resume_site_crawl(run_id: String, control: State<'_, CrawlControl>) -> Result<(), String> {
    control.resume(&run_id);
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn crawl_site(
    app: AppHandle,
    control: State<'_, CrawlControl>,
    start_url: String,
    max_pages: Option<usize>,
    user_agent: Option<String>,
    run_id: Option<String>,
    project_id: Option<String>,
    config: Option<CrawlConfig>,
) -> Result<SiteCrawlResult, String> {
    crawl_site_with_control(
        app, &control, start_url, max_pages, user_agent, run_id, project_id, config,
    )
    .await
}

/// Native entry point shared by the interactive IPC command and the
/// scheduled desktop worker. The worker owns a short-lived `CrawlControl`
/// instance, so all existing cancellation/pause/progress checks remain in the
/// same crawler implementation without requiring a WebView.
#[allow(clippy::too_many_arguments)]
pub async fn crawl_site_with_control(
    app: AppHandle,
    control: &CrawlControl,
    start_url: String,
    max_pages: Option<usize>,
    user_agent: Option<String>,
    run_id: Option<String>,
    project_id: Option<String>,
    config: Option<CrawlConfig>,
) -> Result<SiteCrawlResult, String> {
    let start_time = Instant::now();

    let parsed_base = validate_and_normalize_url(&start_url).map_err(|e| e.to_string())?;

    let base_host = match parsed_base.host_str() {
        Some(h) => h.to_string(),
        None => return Err("URL has no valid hostname".into()),
    };

    let mut config = config.unwrap_or(CrawlConfig {
        crawl_mode: default_http_crawl_mode(),
        render_wait_for_selector: None,
        render_wait_delay_ms: None,
        render_lazy_scroll_cycles: None,
        max_pages,
        max_depth: None,
        include_patterns: Vec::new(),
        exclude_patterns: Vec::new(),
        allow_subdomains: false,
        allowed_hosts: Vec::new(),
        scope_path: None,
        keep_query_strings: false,
        respect_robots: true,
        respect_crawl_delay: true,
        discover_sitemaps: true,
        max_redirects: Some(10),
        follow_nofollow: false,
        max_response_bytes: Some(5_000_000),
        max_run_seconds: Some(300),
        request_timeout_secs: None,
        verify_ssl: true,
        seed_urls: Vec::new(),
        list_mode: false,
        user_agent: None,
        request_profile_id: None,
        trim_trailing_slash: false,
        lowercase_path: false,
        strip_tracking_parameters: false,
        allowed_query_parameters: Vec::new(),
        denied_query_parameters: Vec::new(),
        custom_searches: Vec::new(),
        focus_phrase: None,
        crawl_images: false,
        crawl_stylesheets: false,
        crawl_scripts: false,
        crawl_other_resources: false,
        max_resource_requests: Some(250),
        max_concurrent_requests: Some(4),
        resume_completed_urls: Vec::new(),
        resume_frontier_urls: Vec::new(),
    });
    config.allowed_hosts = normalize_allowed_hosts(&config.allowed_hosts)?;
    config.focus_phrase = config
        .focus_phrase
        .take()
        .map(|phrase| phrase.trim().chars().take(160).collect::<String>())
        .filter(|phrase| !phrase.is_empty());
    if !matches!(config.crawl_mode.as_str(), "http" | "browser-rendered") {
        return Err("Crawl mode must be either http or browser-rendered.".into());
    }
    let normalized_start_url = normalize_crawl_url(parsed_base.clone(), &config);
    let resume_completed_urls: HashSet<String> = config
        .resume_completed_urls
        .iter()
        .filter_map(|candidate| validate_and_normalize_url(candidate).ok())
        .map(|url| normalize_crawl_url(url, &config).to_string())
        .filter(|url| {
            url::Url::parse(url).ok().is_some_and(|parsed| {
                matches_scope(
                    &parsed,
                    &base_host,
                    config.allow_subdomains,
                    config.scope_path.as_deref(),
                    &config.allowed_hosts,
                )
            })
        })
        .take(20_000)
        .collect();
    let resume_frontier_urls: Vec<String> = config
        .resume_frontier_urls
        .iter()
        .filter_map(|candidate| validate_and_normalize_url(candidate).ok())
        .map(|url| normalize_crawl_url(url, &config).to_string())
        .filter(|url| !resume_completed_urls.contains(url))
        .take(20_000)
        .collect();
    validate_custom_searches(&config.custom_searches)?;
    let limit = config
        .max_pages
        .or(max_pages)
        .unwrap_or(25)
        .clamp(1, 10_000);
    let max_depth = config.max_depth.unwrap_or(usize::MAX).min(100);
    let max_redirects = config.max_redirects.unwrap_or(10).min(50);
    let max_response_bytes = config
        .max_response_bytes
        .unwrap_or(5_000_000)
        .clamp(1_024, 50_000_000);
    let max_run_seconds = config
        .max_run_seconds
        .map(|seconds| seconds.clamp(1, 3_600));
    let include_patterns =
        compile_filter_patterns(&config.include_patterns, "include").map_err(|error| {
            format!(
                "Invalid include filter `{}`: {}",
                error.pattern, error.message
            )
        })?;
    let exclude_patterns =
        compile_filter_patterns(&config.exclude_patterns, "exclude").map_err(|error| {
            format!(
                "Invalid exclude filter `{}`: {}",
                error.pattern, error.message
            )
        })?;
    let run_id = run_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    control.start(&run_id);

    let request_profile = match (project_id.as_deref(), config.request_profile_id.as_deref()) {
        (Some(project_id), Some(profile_id)) => Some(crawl_auth_profile(project_id, profile_id)?),
        (None, Some(_)) => {
            return Err("Select a project before using a saved request profile.".into())
        }
        _ => None,
    };
    if config.crawl_mode == "browser-rendered"
        && request_profile
            .as_ref()
            .is_some_and(rendered_profile_has_unsupported_transport)
    {
        return Err(
            "Browser-rendered crawl supports cookies from the selected profile only. Custom headers and proxy profiles require HTTP mode."
                .into(),
        );
    }
    let rendered_cookie = request_profile
        .as_ref()
        .and_then(|profile| profile.cookie.clone());
    let ua = config.user_agent.as_deref().filter(|value| !value.trim().is_empty()).map(str::to_owned)
        .or(user_agent)
        .unwrap_or_else(|| {
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 SEOmi/1.0".into()
    });
    if ua.len() > 1_024 {
        return Err("User-Agent cannot exceed 1024 characters.".into());
    }

    let mut headers = HeaderMap::new();
    let mut ua_value = HeaderValue::from_str(&ua).map_err(|_| "Invalid User-Agent value.")?;
    ua_value.set_sensitive(true);
    headers.insert(USER_AGENT, ua_value);
    let proxy_url = request_profile
        .as_ref()
        .and_then(|profile| profile.proxy_url.clone());
    if let Some(profile) = request_profile {
        for header in profile.headers {
            let name = HeaderName::from_bytes(header.name.trim().as_bytes())
                .map_err(|_| format!("Invalid custom header name `{}`.", header.name))?;
            let mut value = HeaderValue::from_str(&header.value)
                .map_err(|_| format!("Invalid value for custom header `{}`.", header.name))?;
            if name == reqwest::header::AUTHORIZATION
                || name.as_str().contains("token")
                || name.as_str().contains("key")
            {
                value.set_sensitive(true);
            }
            headers.append(name, value);
        }
        if let Some(cookie) = profile.cookie {
            let mut value = HeaderValue::from_str(&cookie)
                .map_err(|_| "Invalid cookie value in request profile.")?;
            value.set_sensitive(true);
            headers.insert(COOKIE, value);
        }
    }

    let mut client_builder = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(
            config.request_timeout_secs.unwrap_or(15).clamp(1, 300),
        ))
        // Redirects are recorded as evidence instead of silently followed. This
        // prevents a redirect from bypassing the URL validation boundary.
        .redirect(reqwest::redirect::Policy::none());
    if !config.verify_ssl {
        client_builder = client_builder.danger_accept_invalid_certs(true);
    }
    if let Some(proxy_url) = proxy_url {
        let proxy = reqwest::Proxy::all(&proxy_url)
            .map_err(|error| format!("Invalid proxy profile: {error}"))?;
        client_builder = client_builder.proxy(proxy);
    }
    let client = client_builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let (robots_rules, robots_txt_status, robots_sitemaps, robots_crawl_delay, robots_agent_matrix) =
        if config.respect_robots || config.discover_sitemaps {
            let robots_url = parsed_base
                .join("/robots.txt")
                .map_err(|error| format!("Failed to construct robots.txt URL: {error}"))?;
            match client.get(robots_url.clone()).send().await {
                Ok(response) if response.status().is_success() => {
                    let content = response.text().await.unwrap_or_default();
                    let rules = parse_robots_rules(&content, &ua);
                    let rule_count = rules.len();
                    let crawl_delay = parse_robots_crawl_delay(&content, &ua);
                    let delay_status = crawl_delay
                        .map(|delay| {
                            let seconds = delay.as_secs_f64();
                            if config.respect_robots && config.respect_crawl_delay {
                                format!("; crawl-delay {seconds:.3}s is enforced")
                            } else {
                                format!("; crawl-delay {seconds:.3}s is ignored by configuration")
                            }
                        })
                        .unwrap_or_default();
                    (
                        rules,
                        format!("Loaded {rule_count} applicable robots.txt rules{delay_status}"),
                        parse_sitemap_directives(&content),
                        crawl_delay.filter(|_| config.respect_robots && config.respect_crawl_delay),
                        build_robots_agent_matrix(&content, &ua),
                    )
                }
                Ok(response) if response.status().as_u16() == 404 => (
                    Vec::new(),
                    "robots.txt not found; URLs allowed".into(),
                    Vec::new(),
                    None,
                    Vec::new(),
                ),
                Ok(response) => (
                    Vec::new(),
                    format!(
                        "robots.txt returned HTTP {}; URLs allowed",
                        response.status()
                    ),
                    Vec::new(),
                    None,
                    Vec::new(),
                ),
                Err(error) => (
                    Vec::new(),
                    format!("robots.txt unavailable ({error}); URLs allowed"),
                    Vec::new(),
                    None,
                    Vec::new(),
                ),
            }
        } else {
            (
                Vec::new(),
                "robots.txt checking disabled by this crawl configuration".into(),
                Vec::new(),
                None,
                Vec::new(),
            )
        };
    let robots_applicable_rules = robots_rules
        .iter()
        .map(|rule| CrawledRobotsRule {
            directive: if rule.allow { "allow" } else { "disallow" }.into(),
            path: rule.path.clone(),
        })
        .collect::<Vec<_>>();
    let robots_sitemap_directives = robots_sitemaps.clone();

    let mut timed_out = false;
    let mut sitemap_urls = Vec::new();
    let mut discovery_sources_by_url: HashMap<String, Vec<CrawledDiscoverySource>> = HashMap::new();
    let mut discovery_provenance_truncated = false;
    let sitemap_status = if config.discover_sitemaps {
        let candidates = if robots_sitemaps.is_empty() {
            vec![parsed_base
                .join("/sitemap.xml")
                .map_err(|error| format!("Failed to construct sitemap URL: {error}"))?
                .to_string()]
        } else {
            robots_sitemaps
        };
        let mut sources_loaded = 0usize;
        let mut sitemap_queue: VecDeque<String> = candidates.into_iter().collect();
        let mut visited_sitemaps = HashSet::new();
        while let Some(candidate) = sitemap_queue.pop_front() {
            if crawl_deadline_reached(start_time, max_run_seconds) {
                timed_out = true;
                break;
            }
            if visited_sitemaps.len() >= 20 || !visited_sitemaps.insert(candidate.clone()) {
                continue;
            }
            let Ok(sitemap_url) = validate_and_normalize_url(&candidate) else {
                continue;
            };
            if !matches_scope(
                &sitemap_url,
                &base_host,
                config.allow_subdomains,
                None,
                &config.allowed_hosts,
            ) {
                continue;
            }
            if let Ok(response) = client.get(sitemap_url.clone()).send().await {
                if response.status().is_success() {
                    sources_loaded += 1;
                    let content = response.text().await.unwrap_or_default();
                    let locations = parse_sitemap_locations(&content);
                    let is_index = content.to_ascii_lowercase().contains("<sitemapindex");
                    for location in locations {
                        if let Ok(url) = validate_and_normalize_url(&location) {
                            if matches_scope(
                                &url,
                                &base_host,
                                config.allow_subdomains,
                                config.scope_path.as_deref(),
                                &config.allowed_hosts,
                            ) {
                                if is_index {
                                    sitemap_queue.push_back(url.to_string());
                                } else {
                                    let normalized = normalize_crawl_url(url, &config);
                                    if sitemap_urls.len() < 10_000 {
                                        let normalized_url = normalized.to_string();
                                        sitemap_urls.push(normalized_url.clone());
                                        discovery_provenance_truncated |= !record_discovery_source(
                                            &mut discovery_sources_by_url,
                                            &normalized_url,
                                            CrawledDiscoverySource {
                                                kind: "sitemap".into(),
                                                source_url: Some(sitemap_url.to_string()),
                                                anchor_text: None,
                                            },
                                        );
                                    } else {
                                        discovery_provenance_truncated = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        sitemap_urls.sort();
        sitemap_urls.dedup();
        format!(
            "Loaded {sources_loaded} sitemap source(s), found {} in-scope URL(s)",
            sitemap_urls.len()
        )
    } else {
        "Sitemap discovery disabled by this crawl configuration".into()
    };

    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<(String, usize)> = VecDeque::new();
    let mut pages: Vec<CrawledPageSummary> = Vec::new();
    let mut rejected_urls: Vec<RejectedCrawlUrl> = Vec::new();

    let mut seed_candidates = if config.list_mode {
        config.seed_urls.clone()
    } else {
        vec![normalized_start_url.to_string()]
    };
    if !config.list_mode {
        seed_candidates.extend(sitemap_urls.iter().cloned());
    }
    seed_candidates.extend(resume_frontier_urls.iter().cloned());
    for candidate in seed_candidates {
        let url = match validate_and_normalize_url(&candidate) {
            Ok(url) => url,
            Err(error) => {
                rejected_urls.push(RejectedCrawlUrl {
                    url: candidate,
                    reason: format!("Rejected by URL safety validation: {error}"),
                });
                continue;
            }
        };
        if !matches_scope(
            &url,
            &base_host,
            config.allow_subdomains,
            config.scope_path.as_deref(),
            &config.allowed_hosts,
        ) {
            rejected_urls.push(RejectedCrawlUrl {
                url: candidate,
                reason: "Outside configured crawl scope".into(),
            });
            continue;
        }
        let normalized = normalize_crawl_url(url, &config).to_string();
        if !matches_filters(&normalized, &include_patterns, &exclude_patterns) {
            rejected_urls.push(RejectedCrawlUrl {
                url: normalized,
                reason: "Excluded by crawl filter".into(),
            });
            continue;
        }
        if resume_completed_urls.contains(&normalized) {
            // Keep checkpointed URLs in the visited set so links from newly
            // fetched pages cannot enqueue them a second time.
            visited.insert(normalized);
            continue;
        }
        let is_start_url = !config.list_mode && normalized == normalized_start_url.to_string();
        if is_start_url {
            discovery_provenance_truncated |= !record_discovery_source(
                &mut discovery_sources_by_url,
                &normalized,
                CrawledDiscoverySource {
                    kind: "start".into(),
                    source_url: None,
                    anchor_text: None,
                },
            );
        } else if config.list_mode {
            discovery_provenance_truncated |= !record_discovery_source(
                &mut discovery_sources_by_url,
                &normalized,
                CrawledDiscoverySource {
                    kind: "seed".into(),
                    source_url: None,
                    anchor_text: None,
                },
            );
        } else if !discovery_sources_by_url.contains_key(&normalized) {
            // Keep a truthful fallback for a sitemap URL whose source document
            // could not be retained, rather than silently presenting it as a
            // start URL.
            discovery_provenance_truncated |= !record_discovery_source(
                &mut discovery_sources_by_url,
                &normalized,
                CrawledDiscoverySource {
                    kind: "sitemap".into(),
                    source_url: None,
                    anchor_text: None,
                },
            );
        }
        if visited.insert(normalized.clone()) {
            queue.push_back((normalized, 0));
        }
    }

    let a_selector = Selector::parse("a[href]").unwrap();
    let title_selector = Selector::parse("title").unwrap();
    let h1_selector = Selector::parse("h1").unwrap();
    let headings_selector = Selector::parse("h1, h2, h3, h4, h5, h6").unwrap();
    let meta_desc_selector = Selector::parse("meta[name='description']").unwrap();
    let canonical_selector = Selector::parse("link[rel][href]").unwrap();
    let robots_selector = Selector::parse("meta[name='robots']").unwrap();
    let meta_refresh_selector = Selector::parse("meta[http-equiv]").unwrap();
    let image_selector = Selector::parse("img[src]").unwrap();
    let script_src_selector = Selector::parse("script[src]").unwrap();
    let link_href_selector = Selector::parse("link[href]").unwrap();
    let media_src_selector = Selector::parse("source[src], video[src], audio[src]").unwrap();
    let html_selector = Selector::parse("html").unwrap();
    let hreflang_selector = Selector::parse("link[hreflang][href]").unwrap();
    let mut robots_blocked_count = 0usize;
    let mut depth_limit_reached = false;
    let mut last_page_request_at: Option<Instant> = None;
    let mut resource_candidates: HashMap<String, ResourceCandidate> = HashMap::new();
    let mut custom_search_remaining_chars = MAX_CUSTOM_SEARCH_CHARS_PER_RUN;
    let mut rendered_session: Option<RenderedCrawlerSession> = None;
    let mut rendered_init_error: Option<String> = None;
    let html_parallelism = if config.crawl_mode == "http" && robots_crawl_delay.is_none() {
        config.max_concurrent_requests.unwrap_or(1).clamp(1, 16)
    } else {
        1
    };
    let mut prefetched_order: VecDeque<(String, usize)> = VecDeque::new();
    let mut prefetched_responses: HashMap<String, Result<FetchedResponse, CrawlFetchFailure>> =
        HashMap::new();

    while let Some((current_url, depth)) =
        prefetched_order.pop_front().or_else(|| queue.pop_front())
    {
        if crawl_deadline_reached(start_time, max_run_seconds) {
            timed_out = true;
            break;
        }
        if !control.wait_until_resumed(&run_id).await {
            break;
        }
        if pages.len() >= limit {
            break;
        }
        if resume_completed_urls.contains(&current_url) {
            continue;
        }

        let current_parsed = url::Url::parse(&current_url)
            .map_err(|error| format!("Failed to parse queued URL: {error}"))?;
        if config.respect_robots && !robots_allows(&current_parsed, &robots_rules) {
            robots_blocked_count += 1;
            let rule = robots_deciding_rule(&current_parsed, &robots_rules)
                .expect("a disallowed URL has a matching robots.txt rule");
            rejected_urls.push(RejectedCrawlUrl {
                url: current_url,
                reason: format!("Blocked by robots.txt Disallow rule: {}", rule.path),
            });
            continue;
        }

        if control.is_cancelled(&run_id) {
            break;
        }
        let _ = app.emit(
            "crawl-progress",
            CrawlProgress {
                run_id: run_id.clone(),
                current_url: Some(current_url.clone()),
                discovered: visited.len(),
                completed: pages.len(),
                // Prefetched URLs are removed from `queue` while their
                // responses wait for deterministic parsing. Count both
                // collections so the desktop UI never reports an empty
                // queue while bounded parallel work is still pending.
                queued: queue.len() + prefetched_order.len(),
                cancelled: false,
                paused: false,
                elapsed_ms: start_time.elapsed().as_millis() as u64,
                pages_per_second: {
                    let elapsed_seconds = start_time.elapsed().as_secs_f64();
                    if elapsed_seconds > 0.0 {
                        pages.len() as f64 / elapsed_seconds
                    } else {
                        0.0
                    }
                },
            },
        );

        if let (Some(delay), Some(last_request_at)) = (robots_crawl_delay, last_page_request_at) {
            if !wait_for_crawl_delay(control, &run_id, last_request_at, delay).await {
                break;
            }
        }
        let page_start = Instant::now();
        last_page_request_at = Some(page_start);
        let prefetched_response = prefetched_responses.remove(&current_url);
        let resp: Result<FetchedResponse, CrawlFetchFailure> = if let Some(response) =
            prefetched_response
        {
            response
        } else if config.crawl_mode == "browser-rendered" {
            if rendered_session.is_none() && rendered_init_error.is_none() {
                let options = RenderOptions {
                    user_agent: Some(ua.clone()),
                    cookie: rendered_cookie.clone(),
                    wait_for_selector: config
                        .render_wait_for_selector
                        .as_deref()
                        .map(str::trim)
                        .filter(|selector| !selector.is_empty())
                        .map(|selector| selector.chars().take(512).collect()),
                    wait_delay_ms: config.render_wait_delay_ms.unwrap_or(0).min(10_000),
                    lazy_scroll_cycles: config.render_lazy_scroll_cycles.unwrap_or(0).min(40),
                };
                match RenderedCrawlerSession::open(
                    &app,
                    &current_url,
                    &base_host,
                    config.allow_subdomains,
                    config.scope_path.as_deref(),
                    options,
                )
                .await
                {
                    Ok(session) => rendered_session = Some(session),
                    Err(message) => rendered_init_error = Some(message),
                }
            }
            if let Some(message) = &rendered_init_error {
                Err(CrawlFetchFailure {
                    kind: "browser_render".into(),
                    message: message.clone(),
                })
            } else {
                let render_timeout = max_run_seconds
                    .map(|seconds| {
                        std::time::Duration::from_secs(seconds).saturating_sub(start_time.elapsed())
                    })
                    .unwrap_or(std::time::Duration::from_secs(60))
                    .min(std::time::Duration::from_secs(60));
                let capture = rendered_session
                    .as_mut()
                    .expect("rendered session initialized")
                    .capture(&current_url);
                tokio::select! {
                    result = capture => result
                        .map(|snapshot| {
                            let final_url = snapshot.final_url.clone();
                            FetchedResponse {
                                response: FetchedPageBody::Rendered(snapshot),
                                final_url,
                                redirect_chain: Vec::new(),
                                redirect_stopped_reason: None,
                            }
                        })
                        .map_err(|message| CrawlFetchFailure { kind: "browser_render".into(), message }),
                    _ = wait_for_crawl_cancellation(control, &run_id) => Err(CrawlFetchFailure {
                        kind: "cancelled".into(),
                        message: "Crawl was cancelled during page rendering.".into(),
                    }),
                    _ = tokio::time::sleep(render_timeout) => {
                        timed_out = true;
                        Err(CrawlFetchFailure {
                            kind: "timeout".into(),
                            message: "Rendered page exceeded the remaining crawl time.".into(),
                        })
                    }
                }
            }
        } else {
            request_with_safe_redirects(
                &client,
                &current_url,
                &base_host,
                config.allow_subdomains,
                config.scope_path.as_deref(),
                &config.allowed_hosts,
                max_redirects,
                &config,
            )
            .await
            .map_err(|error| CrawlFetchFailure {
                kind: request_error_kind(&error),
                message: error.to_string(),
            })
        };
        let page_duration = page_start.elapsed().as_millis() as u64;

        let mut issues: Vec<CrawledPageIssue> = Vec::new();

        match resp {
            Ok(fetched) => {
                let final_url = fetched.final_url;
                let redirect_chain = fetched.redirect_chain;
                let redirect_stopped_reason = fetched.redirect_stopped_reason;
                let FetchedPageData {
                    status,
                    content_type,
                    content_length,
                    content_encoding,
                    http_refresh,
                    cache_control,
                    charset,
                    x_robots_tag,
                    declared_html,
                    body_truncated,
                    body_read_failed,
                    body,
                    rendered_diagnostics,
                    browser_navigation_time_ms,
                    rendered_lcp_ms,
                    rendered_inp_ms,
                    rendered_cls,
                } = read_fetched_page_data(fetched.response, max_response_bytes).await;
                let page_duration = browser_navigation_time_ms.unwrap_or(page_duration);
                let is_html = declared_html && !body_truncated && !body_read_failed;
                if status >= 400 {
                    issues.push(CrawledPageIssue {
                        severity: "Critical".into(),
                        message: format!("HTTP error status {}", status),
                    });
                }

                if !redirect_chain.is_empty() {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!("Safely followed {} redirect(s)", redirect_chain.len()),
                    });
                }
                if let Some(reason) = redirect_stopped_reason.as_ref() {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: reason.clone(),
                    });
                }
                if config.crawl_mode == "browser-rendered" && final_url != current_url {
                    issues.push(CrawledPageIssue { severity: "Info".into(), message: "Browser navigation ended at a different URL; intermediate redirect hops are unavailable in rendered mode".into() });
                }
                if status == 0 && config.crawl_mode == "browser-rendered" {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message:
                            "Browser did not expose the HTTP status for this rendered response"
                                .into(),
                    });
                }
                if let Some((failed_resources, console_errors)) = rendered_diagnostics {
                    for resource in failed_resources.into_iter().take(10) {
                        issues.push(CrawledPageIssue {
                            severity: "Info".into(),
                            message: format!("Browser failed to load a page resource: {resource}"),
                        });
                    }
                    for error in console_errors.into_iter().take(10) {
                        issues.push(CrawledPageIssue {
                            severity: "Info".into(),
                            message: format!("Browser console error: {error}"),
                        });
                    }
                }
                if !declared_html {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Non-HTML resource: HTML SEO checks were skipped".into(),
                    });
                }
                if body_truncated {
                    issues.push(CrawledPageIssue { severity: "Warning".into(), message: format!("Response body exceeded the configured {} byte limit; HTML checks were skipped", max_response_bytes) });
                }
                if body_read_failed {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message:
                            "Response body could not be read completely; HTML checks were skipped"
                                .into(),
                    });
                }

                let (text, detected_charset, mut html_validation_findings) = if is_html {
                    decode_crawl_html_body(&body, charset.as_deref())
                } else {
                    (
                        String::from_utf8_lossy(&body).into_owned(),
                        None,
                        Vec::new(),
                    )
                };
                let document = Html::parse_document(&text);
                let (html_findings, html_validation_truncated) = if is_html {
                    validate_crawl_html_with_charset(
                        &document,
                        &text,
                        &url::Url::parse(&final_url).unwrap_or_else(|_| current_parsed.clone()),
                        charset.as_deref(),
                    )
                } else {
                    (Vec::new(), false)
                };
                html_validation_findings.extend(html_findings);
                let custom_search_results = if is_html {
                    extract_custom_search_results_with_html(
                        &document,
                        Some(&text),
                        &config.custom_searches,
                        &mut custom_search_remaining_chars,
                    )
                } else {
                    Vec::new()
                };
                let document_language = document
                    .select(&html_selector)
                    .next()
                    .and_then(|element| element.value().attr("lang"))
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_owned);
                if is_html && document_language.is_none() {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Document has no html lang attribute".into(),
                    });
                }
                let final_base = url::Url::parse(&final_url)
                    .map_err(|error| format!("Failed to parse final URL: {error}"))?;
                let (favicons, social_meta_tags, favicon_metadata) = if is_html {
                    let (urls, social) = crawl_social_metadata(&document, &final_base);
                    (urls, social, crawl_favicon_metadata(&document, &final_base))
                } else {
                    (Vec::new(), Vec::new(), Vec::new())
                };
                let (frames, frames_truncated) = if is_html {
                    crawl_frames(&document, &final_base)
                } else {
                    (Vec::new(), false)
                };
                let favicon_resource_checks = favicons
                    .iter()
                    .map(|favicon| unchecked_social_resource(favicon))
                    .collect::<Vec<_>>();
                for favicon in &favicon_resource_checks {
                    add_resource_candidate(
                        &mut resource_candidates,
                        &final_url,
                        &final_base,
                        &favicon.url,
                        "image",
                        &base_host,
                        &config,
                    );
                }
                for social_image in social_meta_tags
                    .iter()
                    .filter_map(|tag| tag.resource_check.as_ref())
                {
                    add_resource_candidate(
                        &mut resource_candidates,
                        &final_url,
                        &final_base,
                        &social_image.url,
                        "image",
                        &base_host,
                        &config,
                    );
                }
                let mut hreflangs = Vec::new();
                for element in document.select(&hreflang_selector) {
                    let Some(language) = element
                        .value()
                        .attr("hreflang")
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                    else {
                        continue;
                    };
                    let Some(href) = element.value().attr("href") else {
                        continue;
                    };
                    if let Ok(target) = final_base.join(href) {
                        hreflangs.push(CrawledHreflang {
                            language: language.to_string(),
                            target_url: target.to_string(),
                            target_http_status: None,
                            target_checked_in_run: false,
                            reciprocal_in_run: None,
                            target_canonical_alignment: None,
                        });
                    }
                }
                hreflangs.sort_by(|left, right| {
                    left.language
                        .cmp(&right.language)
                        .then(left.target_url.cmp(&right.target_url))
                });
                let amp_url = document
                    .select(&canonical_selector)
                    .find_map(|element| {
                        let rel = element.value().attr("rel")?;
                        rel.split_ascii_whitespace()
                            .any(|value| value.eq_ignore_ascii_case("amphtml"))
                            .then(|| element.value().attr("href"))
                            .flatten()
                    })
                    .and_then(|href| final_base.join(href).ok())
                    .map(|url| url.to_string());
                let (
                    pagination_links,
                    pagination_declaration_count,
                    pagination_invalid_declaration_count,
                ) = crawl_pagination_links(&document, &final_base);
                let pagination_next = pagination_links
                    .iter()
                    .find(|link| link.relation == "next")
                    .map(|link| link.target_url.clone());
                let pagination_prev = pagination_links
                    .iter()
                    .find(|link| link.relation == "prev")
                    .map(|link| link.target_url.clone());
                let content_metrics = if is_html {
                    content_metrics(&document, body.len(), document_language.as_deref())
                } else {
                    ContentMetrics::default()
                };
                let word_count = content_metrics.word_count;
                let content_hash = content_metrics.content_hash.clone();
                let text_ratio_percent = content_metrics.text_ratio_percent;
                let reading_time_minutes = content_metrics.reading_time_minutes;
                let content_simhash = is_html.then(|| content_simhash(&document)).flatten();
                let semantic_terms = if is_html {
                    extract_semantic_terms(&document)
                } else {
                    Vec::new()
                };
                let semantic_excerpts = if is_html {
                    extract_semantic_excerpts(&document)
                } else {
                    Vec::new()
                };
                let has_primary_content_root = is_html && has_semantic_content_root(&document);
                let semantic_content_source =
                    semantic_content_source(&document, is_html, body_truncated, body_read_failed);
                let (
                    schema_types,
                    schema_syntax_errors,
                    schema_validation_findings,
                    schema_references,
                    schema_validation_truncated,
                ) = if is_html {
                    inspect_page_schema(&document)
                } else {
                    (Vec::new(), 0, Vec::new(), Vec::new(), false)
                };
                if schema_syntax_errors > 0 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!("{} invalid JSON-LD block(s)", schema_syntax_errors),
                    });
                }
                if is_html && word_count < 50 {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!("Thin text content: {word_count} words"),
                    });
                }

                // Title check
                let titles = document
                    .select(&title_selector)
                    .map(|el| el.text().collect::<Vec<_>>().join("").trim().to_string())
                    .collect::<Vec<_>>();
                let title = titles.first().cloned();
                let title_length = title.as_deref().map(|value| value.chars().count());

                if is_html
                    && (title.is_none() || title.as_ref().map(|t| t.is_empty()).unwrap_or(true))
                {
                    issues.push(CrawledPageIssue {
                        severity: "Critical".into(),
                        message: "Missing <title> tag".into(),
                    });
                }
                if is_html && titles.len() > 1 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!("Multiple <title> tags found ({})", titles.len()),
                    });
                }
                if is_html && title_length.is_some_and(|length| !(30..=60).contains(&length)) {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!(
                            "Title length is {} characters; reference range is 30–60",
                            title_length.unwrap_or_default()
                        ),
                    });
                }

                // H1 check
                let h1_count = document.select(&h1_selector).count();
                let heading_levels = document
                    .select(&headings_selector)
                    .filter_map(|element| element.value().name().strip_prefix('h'))
                    .filter_map(|value| value.parse::<usize>().ok())
                    .collect::<Vec<_>>();
                let mut heading_counts = vec![0usize; 6];
                for level in &heading_levels {
                    if (1..=6).contains(level) {
                        heading_counts[*level - 1] += 1;
                    }
                }
                let duplicate_headings = if is_html {
                    duplicate_heading_groups(&document, &headings_selector)
                } else {
                    Vec::new()
                };
                for duplicate in &duplicate_headings {
                    let levels = duplicate
                        .levels
                        .iter()
                        .map(|level| format!("H{level}"))
                        .collect::<Vec<_>>()
                        .join("/");
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!(
                            "Repeated heading text {:?} across {levels} ({} occurrences)",
                            duplicate.text, duplicate.occurrences
                        ),
                    });
                }
                if is_html && h1_count == 0 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: "Missing <h1> tag".into(),
                    });
                } else if is_html && h1_count > 1 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!("Multiple <h1> tags found ({})", h1_count),
                    });
                }
                if is_html
                    && heading_levels
                        .windows(2)
                        .any(|levels| levels[1] > levels[0] + 1)
                {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Heading hierarchy skips one or more levels".into(),
                    });
                }

                // Meta description check
                let meta_descriptions = document
                    .select(&meta_desc_selector)
                    .filter_map(|element| element.value().attr("content"))
                    .map(str::trim)
                    .map(str::to_owned)
                    .collect::<Vec<_>>();
                let meta_description = meta_descriptions
                    .first()
                    .filter(|value| !value.is_empty())
                    .cloned();
                let meta_description_length = meta_description
                    .as_deref()
                    .map(|value| value.chars().count());
                let focus_phrase = if is_html {
                    focus_phrase_evidence(
                        &document,
                        title.as_deref(),
                        meta_description.as_deref(),
                        config.focus_phrase.as_deref(),
                    )
                } else {
                    None
                };
                if is_html && meta_descriptions.is_empty() {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Missing meta description tag".into(),
                    });
                } else if is_html && meta_description.is_none() {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: "Meta description is empty".into(),
                    });
                }
                if is_html && meta_descriptions.len() > 1 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!(
                            "Multiple meta description tags found ({})",
                            meta_descriptions.len()
                        ),
                    });
                }
                if is_html
                    && meta_description_length.is_some_and(|length| !(70..=160).contains(&length))
                {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!(
                            "Meta description length is {} characters; reference range is 70–160",
                            meta_description_length.unwrap_or_default()
                        ),
                    });
                }

                let (canonical_declaration_count, canonical_urls) =
                    crawl_canonical_declarations(&document, &final_base);
                let canonical = canonical_urls.first().cloned();
                if is_html && canonical_declaration_count == 0 {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Missing canonical link".into(),
                    });
                }
                if is_html && canonical_declaration_count > 1 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!(
                            "Multiple canonical links found ({})",
                            canonical_declaration_count
                        ),
                    });
                } else if is_html && canonical_declaration_count == 1 && canonical.is_none() {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: "Canonical declaration has a missing, invalid, or non-HTTP URL"
                            .into(),
                    });
                }

                let meta_robots = document
                    .select(&robots_selector)
                    .next()
                    .and_then(|element| element.value().attr("content"))
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_owned);
                let meta_refreshes = document
                    .select(&meta_refresh_selector)
                    .filter_map(|element| {
                        element
                            .value()
                            .attr("http-equiv")
                            .filter(|value| value.eq_ignore_ascii_case("refresh"))
                            .and_then(|_| element.value().attr("content"))
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                    })
                    .collect::<Vec<_>>();
                let mut client_redirects = meta_refreshes
                    .iter()
                    .map(|declaration| {
                        parse_client_redirect("meta-refresh", declaration, &final_base)
                    })
                    .collect::<Vec<_>>();
                if let Some(declaration) = http_refresh {
                    client_redirects.push(parse_client_redirect(
                        "http-refresh",
                        &declaration,
                        &final_base,
                    ));
                }
                client_redirects.extend(extract_javascript_redirects(&document, &final_base));
                if !client_redirects.is_empty() {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!(
                            "Client-side refresh redirect detected ({} declaration(s))",
                            client_redirects.len()
                        ),
                    });
                }
                let meta_noindex = meta_robots
                    .as_deref()
                    .is_some_and(|value| value.to_ascii_lowercase().contains("noindex"));
                let header_noindex = x_robots_tag
                    .as_deref()
                    .is_some_and(|value| value.to_ascii_lowercase().contains("noindex"));
                let meta_nofollow = meta_robots
                    .as_deref()
                    .is_some_and(|value| value.to_ascii_lowercase().contains("nofollow"));
                let header_nofollow = x_robots_tag
                    .as_deref()
                    .is_some_and(|value| value.to_ascii_lowercase().contains("nofollow"));
                if meta_noindex {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Page declares noindex in meta robots".into(),
                    });
                }
                if header_noindex {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Response declares noindex in X-Robots-Tag".into(),
                    });
                }
                if meta_nofollow {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Page declares nofollow in meta robots".into(),
                    });
                }
                if header_nofollow {
                    issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "Response declares nofollow in X-Robots-Tag".into(),
                    });
                }
                let canonical_points_elsewhere = canonical.as_deref().is_some_and(|target| {
                    classify_canonical_relation(&final_url, 1, &[target.to_string()]) != "self"
                });
                let canonical_relation = classify_canonical_relation(
                    &final_url,
                    canonical_declaration_count,
                    &canonical_urls,
                );
                let pagination_canonical_alignment = (pagination_declaration_count > 0)
                    .then(|| pagination_canonical_alignment(canonical_relation))
                    .flatten();
                if is_html && pagination_invalid_declaration_count > 0 {
                    issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!(
                            "{} pagination declaration(s) have a missing or invalid HTTP(S) target",
                            pagination_invalid_declaration_count
                        ),
                    });
                }
                let canonical_targets = canonical_urls
                    .iter()
                    .map(|target| CrawledCanonicalTarget {
                        url: target.clone(),
                        relation: classify_canonical_relation(
                            &final_url,
                            1,
                            std::slice::from_ref(target),
                        )
                        .to_string(),
                        http_status: None,
                        checked_in_run: false,
                    })
                    .collect::<Vec<_>>();
                let canonical_robots_conflict =
                    canonical.is_some() && (meta_noindex || header_noindex);
                if is_html && canonical_points_elsewhere {
                    issues.push(CrawledPageIssue { severity: "Info".into(), message: "Canonical points to a different URL; the target was not validated in this verdict".into() });
                }
                if is_html && canonical_robots_conflict {
                    issues.push(CrawledPageIssue { severity: "Warning".into(), message: "Canonical and noindex are both present; review the intended indexing signal".into() });
                }
                let indexability_status = if status == 0 && config.crawl_mode == "browser-rendered"
                {
                    "HTTP status unavailable from rendered document".to_string()
                } else if status >= 400 {
                    "Blocked by HTTP error".to_string()
                } else if meta_noindex || header_noindex {
                    "Excluded by robots directive".to_string()
                } else if canonical_points_elsewhere {
                    "Canonical points to a different URL".to_string()
                } else if meta_nofollow || header_nofollow {
                    "Eligible from this response only; link following is restricted".to_string()
                } else if status >= 300 {
                    "Redirect response — target not evaluated".to_string()
                } else if config.crawl_mode == "browser-rendered" {
                    "Rendered DOM checked; X-Robots-Tag response header unavailable".to_string()
                } else {
                    "Eligible from this response only".to_string()
                };
                let robots_decision = Some(build_robots_decision(
                    meta_robots.as_deref(),
                    x_robots_tag.as_deref(),
                    config.crawl_mode != "browser-rendered",
                ));
                let indexability_verdict = Some(build_indexability_verdict(
                    status,
                    &config.crawl_mode,
                    meta_noindex,
                    header_noindex,
                    canonical_points_elsewhere,
                    meta_nofollow,
                    header_nofollow,
                ));

                // Extract internal links to queue
                let mut internal_link_count = 0usize;
                let mut external_link_count = 0usize;
                let mut links = Vec::new();
                let mut semantic_links = Vec::new();
                let mut images = Vec::new();
                if is_html {
                    let current_base = final_base;
                    for element in document.select(&a_selector) {
                        if let Some(href) = element.value().attr("href") {
                            if href.starts_with('#')
                                || href.starts_with("javascript:")
                                || href.starts_with("mailto:")
                            {
                                continue;
                            }

                            if let Ok(resolved) = current_base.join(href) {
                                if resolved.scheme() == "http" || resolved.scheme() == "https" {
                                    let is_internal = matches_scope(
                                        &resolved,
                                        &base_host,
                                        config.allow_subdomains,
                                        config.scope_path.as_deref(),
                                        &config.allowed_hosts,
                                    );
                                    let anchor_text = element
                                        .text()
                                        .collect::<Vec<_>>()
                                        .join(" ")
                                        .split_whitespace()
                                        .collect::<Vec<_>>()
                                        .join(" ");
                                    let is_semantic_content_link = semantic_content_contains(
                                        &element,
                                        has_primary_content_root,
                                    );
                                    let rel = element.value().attr("rel").map(str::to_owned);
                                    let source_excerpt = bounded_link_source_excerpt(&element);
                                    let is_nofollow = rel.as_deref().is_some_and(|value| {
                                        value
                                            .split_ascii_whitespace()
                                            .any(|token| token.eq_ignore_ascii_case("nofollow"))
                                    });
                                    let target_for_run =
                                        normalize_crawl_url(resolved.clone(), &config);
                                    if is_internal {
                                        discovery_provenance_truncated |= !record_discovery_source(
                                            &mut discovery_sources_by_url,
                                            target_for_run.as_str(),
                                            CrawledDiscoverySource {
                                                kind: "link".into(),
                                                source_url: Some(final_url.clone()),
                                                anchor_text: (!anchor_text.is_empty())
                                                    .then_some(anchor_text.clone()),
                                            },
                                        );
                                    }
                                    if links.len() < 5_000 {
                                        links.push(CrawledLink {
                                            target_url: target_for_run.to_string(),
                                            anchor_text: anchor_text.clone(),
                                            rel: rel.clone(),
                                            is_internal,
                                            source_excerpt: source_excerpt.clone(),
                                            target_http_status: None,
                                            target_response_time_ms: None,
                                            target_redirect_url: None,
                                            target_request_error_kind: None,
                                            target_checked_at: None,
                                        });
                                    }
                                    if is_internal
                                        && is_semantic_content_link
                                        && semantic_links.len()
                                            < MAX_SEMANTIC_CONTENT_LINKS_PER_PAGE
                                    {
                                        semantic_links.push(CrawledLink {
                                            target_url: target_for_run.to_string(),
                                            anchor_text,
                                            rel,
                                            is_internal: true,
                                            source_excerpt,
                                            target_http_status: None,
                                            target_response_time_ms: None,
                                            target_redirect_url: None,
                                            target_request_error_kind: None,
                                            target_checked_at: None,
                                        });
                                    }
                                    if is_other_resource_url(&resolved) {
                                        add_resource_candidate(
                                            &mut resource_candidates,
                                            &final_url,
                                            &current_base,
                                            href,
                                            "other",
                                            &base_host,
                                            &config,
                                        );
                                    }
                                    if is_internal {
                                        internal_link_count += 1;
                                        let url_str =
                                            normalize_crawl_url(resolved.clone(), &config)
                                                .to_string();

                                        if !config.list_mode
                                            && depth >= max_depth
                                            && (config.follow_nofollow || !is_nofollow)
                                            && matches_filters(
                                                &url_str,
                                                &include_patterns,
                                                &exclude_patterns,
                                            )
                                            && !visited.contains(&url_str)
                                        {
                                            depth_limit_reached = true;
                                        }

                                        if !config.list_mode
                                            && depth < max_depth
                                            && (config.follow_nofollow || !is_nofollow)
                                            && matches_filters(
                                                &url_str,
                                                &include_patterns,
                                                &exclude_patterns,
                                            )
                                            && !visited.contains(&url_str)
                                            && queue.len() + pages.len() < limit * 2
                                        {
                                            visited.insert(url_str.clone());
                                            queue.push_back((url_str, depth + 1));
                                        }
                                    } else {
                                        external_link_count += 1;
                                    }
                                }
                            }
                        }
                    }
                    let mut missing_alt_count = 0usize;
                    for element in document.select(&image_selector) {
                        let Some(src) = element.value().attr("src") else {
                            continue;
                        };
                        let src = src.trim();
                        let inline_image = src.to_ascii_lowercase().starts_with("data:image/");
                        let resolved = current_base
                            .join(src)
                            .ok()
                            .filter(|url| url.scheme() == "http" || url.scheme() == "https");
                        if resolved.is_none() && !inline_image {
                            continue;
                        }
                        let alt = element.value().attr("alt").map(str::to_owned);
                        let srcset = element.value().attr("srcset").map(str::to_owned);
                        let inline_dimensions =
                            inline_image.then(|| inline_image_dimensions(src)).flatten();
                        let attribute_width = element
                            .value()
                            .attr("width")
                            .and_then(|value| value.trim().parse().ok());
                        let attribute_height = element
                            .value()
                            .attr("height")
                            .and_then(|value| value.trim().parse().ok());
                        let width =
                            attribute_width.or_else(|| inline_dimensions.map(|value| value.0));
                        let height =
                            attribute_height.or_else(|| inline_dimensions.map(|value| value.1));
                        let dimensions_source =
                            if attribute_width.is_some() && attribute_height.is_some() {
                                Some("attributes".to_string())
                            } else if inline_dimensions.is_some() {
                                Some(
                                    if attribute_width.is_some() || attribute_height.is_some() {
                                        "mixed"
                                    } else {
                                        "intrinsic-data-uri"
                                    }
                                    .to_string(),
                                )
                            } else {
                                None
                            };
                        let parsed_srcset_urls =
                            srcset.as_deref().map(parse_srcset_urls).unwrap_or_default();
                        let srcset_resource_checks = parsed_srcset_urls
                            .iter()
                            .take(MAX_SRCSET_CANDIDATES_PER_IMAGE)
                            .filter_map(|candidate| {
                                let resolved = current_base.join(candidate).ok()?;
                                (resolved.scheme() == "http" || resolved.scheme() == "https").then(
                                    || CrawledImageResourceCheck {
                                        url: resolved.to_string(),
                                        checked_in_run: false,
                                        http_status: None,
                                        content_length: None,
                                        request_error_kind: None,
                                    },
                                )
                            })
                            .collect::<Vec<_>>();
                        if alt.is_none() {
                            missing_alt_count += 1;
                        }
                        if images.len() < 5_000 {
                            images.push(CrawledImage {
                                src: resolved
                                    .as_ref()
                                    .map(ToString::to_string)
                                    .unwrap_or_else(|| bounded_inline_image_uri(src)),
                                alt,
                                srcset,
                                format: if inline_image {
                                    inline_image_format(src)
                                } else {
                                    resolved.as_ref().and_then(|url| {
                                        url.path()
                                            .rsplit('.')
                                            .next()
                                            .filter(|extension| *extension != url.path())
                                            .map(|extension| extension.to_ascii_lowercase())
                                    })
                                },
                                width,
                                height,
                                dimensions_source,
                                lazy_loaded: element
                                    .value()
                                    .attr("loading")
                                    .is_some_and(|value| value.eq_ignore_ascii_case("lazy")),
                                checked_in_run: false,
                                http_status: None,
                                content_length: None,
                                request_error_kind: None,
                                srcset_resource_checks,
                                srcset_resource_checks_truncated: parsed_srcset_urls.len()
                                    > MAX_SRCSET_CANDIDATES_PER_IMAGE,
                            });
                        }
                        if resolved.is_some() {
                            add_resource_candidate(
                                &mut resource_candidates,
                                &final_url,
                                &current_base,
                                src,
                                "image",
                                &base_host,
                                &config,
                            );
                        }
                        for candidate in parsed_srcset_urls
                            .iter()
                            .take(MAX_SRCSET_CANDIDATES_PER_IMAGE)
                        {
                            add_resource_candidate(
                                &mut resource_candidates,
                                &final_url,
                                &current_base,
                                candidate,
                                "image",
                                &base_host,
                                &config,
                            );
                        }
                    }
                    for element in document.select(&script_src_selector) {
                        if let Some(src) = element.value().attr("src") {
                            add_resource_candidate(
                                &mut resource_candidates,
                                &final_url,
                                &current_base,
                                src,
                                "script",
                                &base_host,
                                &config,
                            );
                        }
                    }
                    for element in document.select(&link_href_selector) {
                        let Some(href) = element.value().attr("href") else {
                            continue;
                        };
                        let rel = element.value().attr("rel").unwrap_or("");
                        let resource_type = if rel
                            .split_ascii_whitespace()
                            .any(|value| value.eq_ignore_ascii_case("stylesheet"))
                        {
                            "stylesheet"
                        } else {
                            "other"
                        };
                        add_resource_candidate(
                            &mut resource_candidates,
                            &final_url,
                            &current_base,
                            href,
                            resource_type,
                            &base_host,
                            &config,
                        );
                    }
                    for element in document.select(&media_src_selector) {
                        if let Some(src) = element.value().attr("src") {
                            add_resource_candidate(
                                &mut resource_candidates,
                                &final_url,
                                &current_base,
                                src,
                                "other",
                                &base_host,
                                &config,
                            );
                        }
                    }
                    for frame in &frames {
                        if let Some(frame_url) = &frame.resolved_url {
                            add_resource_candidate(
                                &mut resource_candidates,
                                &final_url,
                                &current_base,
                                frame_url,
                                "other",
                                &base_host,
                                &config,
                            );
                        }
                    }
                    if missing_alt_count > 0 {
                        issues.push(CrawledPageIssue {
                            severity: "Warning".into(),
                            message: format!(
                                "{} image(s) missing an alt attribute",
                                missing_alt_count
                            ),
                        });
                    }
                }

                let semantic_content_partial = semantic_content_is_partial(
                    body_truncated,
                    body_read_failed,
                    semantic_terms.len(),
                    semantic_excerpts.len(),
                    semantic_links.len(),
                );
                let semantic_content_provenance =
                    semantic_provenance_for_mode(&config.crawl_mode, &semantic_content_source);
                let issues_count = issues.len();
                let discovery_sources = discovery_sources_by_url
                    .remove(&current_url)
                    .unwrap_or_default();
                pages.push(CrawledPageSummary {
                    url: current_url,
                    final_url,
                    discovery_sources,
                    redirect_chain,
                    redirect_stop_reason: redirect_stopped_reason,
                    depth,
                    http_status: status,
                    response_time_ms: page_duration,
                    rendered_lcp_ms,
                    rendered_inp_ms,
                    rendered_cls,
                    request_error_kind: None,
                    title,
                    title_length,
                    meta_description,
                    meta_description_length,
                    canonical,
                    canonical_targets,
                    canonical_declaration_count,
                    canonical_relation: canonical_relation.to_string(),
                    canonical_robots_conflict,
                    client_redirects,
                    meta_robots,
                    x_robots_tag,
                    robots_decision,
                    indexability_verdict,
                    indexability_status,
                    content_type,
                    content_length,
                    content_encoding,
                    charset,
                    detected_charset,
                    cache_control,
                    body_truncated,
                    word_count,
                    text_ratio_percent,
                    reading_time_minutes,
                    sentence_count: content_metrics.sentence_count,
                    average_words_per_sentence: content_metrics.average_words_per_sentence,
                    average_characters_per_word: content_metrics.average_characters_per_word,
                    complexity_score: content_metrics.complexity_score,
                    complexity_label: content_metrics.complexity_label.clone(),
                    readability_ease_score: content_metrics.readability_ease_score,
                    readability_grade: content_metrics.readability_grade,
                    readability_method: content_metrics.readability_method.clone(),
                    readability_label: content_metrics.readability_label.clone(),
                    content_terms: content_metrics.content_terms.clone(),
                    focus_phrase,
                    content_hash,
                    content_simhash,
                    semantic_terms,
                    semantic_excerpts,
                    semantic_links,
                    semantic_content_source,
                    semantic_content_provenance,
                    semantic_content_partial,
                    schema_types,
                    schema_references,
                    schema_syntax_errors,
                    schema_validation_findings,
                    schema_validation_truncated,
                    html_validation_findings,
                    html_validation_truncated,
                    document_language,
                    hreflangs,
                    amp_url,
                    amp_target_http_status: None,
                    amp_target_checked_in_run: false,
                    amp_target_canonical_alignment: None,
                    h1_count,
                    heading_counts,
                    duplicate_headings,
                    pagination_next,
                    pagination_prev,
                    pagination_links,
                    pagination_declaration_count,
                    pagination_invalid_declaration_count,
                    pagination_canonical_alignment,
                    internal_link_count,
                    external_link_count,
                    links,
                    images,
                    frames,
                    frames_truncated,
                    favicons,
                    favicon_metadata,
                    favicon_resource_checks,
                    social_meta_tags,
                    custom_search_results,
                    issues_count,
                    issues,
                });
            }
            Err(e) => {
                if e.kind == "cancelled" {
                    break;
                }
                let error_kind = e.kind;
                issues.push(CrawledPageIssue {
                    severity: "Critical".into(),
                    message: format!(
                        "{} request failed: {}",
                        error_kind.to_ascii_uppercase(),
                        e.message
                    ),
                });
                let discovery_sources = discovery_sources_by_url
                    .remove(&current_url)
                    .unwrap_or_default();
                pages.push(CrawledPageSummary {
                    url: current_url.clone(),
                    final_url: current_url,
                    discovery_sources,
                    redirect_chain: Vec::new(),
                    redirect_stop_reason: None,
                    depth,
                    http_status: 0,
                    response_time_ms: page_duration,
                    rendered_lcp_ms: None,
                    rendered_inp_ms: None,
                    rendered_cls: None,
                    request_error_kind: Some(error_kind),
                    title: None,
                    title_length: None,
                    meta_description: None,
                    meta_description_length: None,
                    canonical: None,
                    canonical_targets: Vec::new(),
                    canonical_declaration_count: 0,
                    canonical_relation: "unavailable".into(),
                    canonical_robots_conflict: false,
                    client_redirects: Vec::new(),
                    meta_robots: None,
                    x_robots_tag: None,
                    robots_decision: None,
                    indexability_verdict: Some(CrawledIndexabilityVerdict {
                        status: "uncertain".into(),
                        reasons: vec!["request_failed".into()],
                    }),
                    indexability_status: "Unavailable: request failed".into(),
                    content_type: None,
                    content_length: None,
                    content_encoding: None,
                    charset: None,
                    detected_charset: None,
                    cache_control: None,
                    body_truncated: false,
                    word_count: 0,
                    text_ratio_percent: None,
                    reading_time_minutes: None,
                    sentence_count: None,
                    average_words_per_sentence: None,
                    average_characters_per_word: None,
                    complexity_score: None,
                    complexity_label: None,
                    readability_ease_score: None,
                    readability_grade: None,
                    readability_method: None,
                    readability_label: None,
                    content_terms: Vec::new(),
                    focus_phrase: None,
                    content_hash: None,
                    content_simhash: None,
                    semantic_terms: Vec::new(),
                    semantic_excerpts: Vec::new(),
                    semantic_links: Vec::new(),
                    semantic_content_source: default_semantic_content_source(),
                    semantic_content_provenance: default_semantic_content_provenance(),
                    semantic_content_partial: false,
                    schema_types: Vec::new(),
                    schema_references: Vec::new(),
                    schema_syntax_errors: 0,
                    schema_validation_findings: Vec::new(),
                    schema_validation_truncated: false,
                    html_validation_findings: Vec::new(),
                    html_validation_truncated: false,
                    document_language: None,
                    hreflangs: Vec::new(),
                    amp_url: None,
                    amp_target_http_status: None,
                    amp_target_checked_in_run: false,
                    amp_target_canonical_alignment: None,
                    h1_count: 0,
                    heading_counts: vec![0; 6],
                    duplicate_headings: Vec::new(),
                    pagination_next: None,
                    pagination_prev: None,
                    pagination_links: Vec::new(),
                    pagination_declaration_count: 0,
                    pagination_invalid_declaration_count: 0,
                    pagination_canonical_alignment: None,
                    internal_link_count: 0,
                    external_link_count: 0,
                    links: Vec::new(),
                    images: Vec::new(),
                    frames: Vec::new(),
                    frames_truncated: false,
                    favicons: Vec::new(),
                    favicon_metadata: Vec::new(),
                    favicon_resource_checks: Vec::new(),
                    social_meta_tags: Vec::new(),
                    custom_search_results: Vec::new(),
                    issues_count: 1,
                    issues,
                });
            }
        }
        if html_parallelism > 1
            && !timed_out
            && !control.is_cancelled(&run_id)
            && !crawl_deadline_reached(start_time, max_run_seconds)
        {
            prefetch_http_pages(
                &mut queue,
                &mut prefetched_order,
                &mut prefetched_responses,
                html_parallelism,
                limit,
                pages.len(),
                &client,
                &base_host,
                config.allow_subdomains,
                config.scope_path.as_deref(),
                &config.allowed_hosts,
                max_redirects,
                &config,
                &robots_rules,
            )
            .await;
        }
    }

    let crawled_statuses = pages
        .iter()
        .filter(|page| !(config.crawl_mode == "browser-rendered" && page.http_status == 0))
        .flat_map(|page| {
            [
                (page.url.clone(), page.http_status),
                (page.final_url.clone(), page.http_status),
            ]
        })
        .collect::<std::collections::HashMap<_, _>>();
    let pagination_graph = pagination_edges(&pages);
    let crawled_page_identities = pages
        .iter()
        .flat_map(|page| [page.url.as_str(), page.final_url.as_str()])
        .filter_map(canonical_identity_url)
        .map(|url| url.to_string())
        .collect::<HashSet<_>>();
    for page in &mut pages {
        for target in &mut page.canonical_targets {
            if let Some(status) = verify_canonical_target(target, &crawled_statuses) {
                if status == 0 || status >= 400 {
                    page.issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!("Canonical target returned HTTP {status} in this crawl"),
                    });
                }
            }
        }
        for target in &mut page.pagination_links {
            if let Some(status) = verify_pagination_target(target, &crawled_statuses) {
                if status == 0 || status >= 400 {
                    page.issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!(
                            "Pagination {} target returned HTTP {status} in this crawl",
                            target.relation
                        ),
                    });
                }
            }
            let Some(expected_relation) = opposite_pagination_relation(&target.relation) else {
                continue;
            };
            let Some(source_identity) = canonical_identity_url(&page.final_url)
                .or_else(|| canonical_identity_url(&page.url))
                .map(|url| url.to_string())
            else {
                continue;
            };
            let Some(target_identity) =
                canonical_identity_url(&target.target_url).map(|url| url.to_string())
            else {
                continue;
            };
            if crawled_page_identities.contains(&target_identity) {
                target.reciprocal_in_run = Some(pagination_graph.contains(&(
                    target_identity,
                    expected_relation.to_string(),
                    source_identity,
                )));
                if target.reciprocal_in_run == Some(false) {
                    page.issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: format!(
                            "Pagination {} target has no reciprocal {} declaration in this crawl",
                            target.relation, expected_relation
                        ),
                    });
                }
            }
        }
        for link in &mut page.links {
            if link.is_internal {
                link.target_http_status = crawled_statuses.get(&link.target_url).copied();
            }
        }
        let broken_targets = page
            .links
            .iter()
            .filter(|link| {
                link.is_internal
                    && link
                        .target_http_status
                        .is_some_and(|status| status == 0 || status >= 400)
            })
            .map(|link| link.target_url.as_str())
            .collect::<HashSet<_>>();
        if !broken_targets.is_empty() {
            page.issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: format!(
                    "{} internal link target(s) returned an error in this crawl",
                    broken_targets.len()
                ),
            });
        }
        page.issues_count = page.issues.len();
    }
    let hreflang_targets = pages
        .iter()
        .flat_map(|page| {
            [
                (
                    page.url.clone(),
                    page.hreflangs
                        .iter()
                        .map(|item| item.target_url.clone())
                        .collect::<HashSet<_>>(),
                ),
                (
                    page.final_url.clone(),
                    page.hreflangs
                        .iter()
                        .map(|item| item.target_url.clone())
                        .collect::<HashSet<_>>(),
                ),
            ]
        })
        .collect::<std::collections::HashMap<_, _>>();
    let canonical_targets = pages
        .iter()
        .flat_map(|page| {
            [
                (page.url.clone(), page.canonical.clone()),
                (page.final_url.clone(), page.canonical.clone()),
            ]
        })
        .collect::<std::collections::HashMap<_, _>>();
    for page in &mut pages {
        let Some(amp_url) = page.amp_url.clone() else {
            continue;
        };
        let (status, canonical_alignment) = verify_amp_target(
            &page.url,
            &page.final_url,
            &amp_url,
            &crawled_statuses,
            &canonical_targets,
        );
        match status {
            Some(status) => {
                page.amp_target_http_status = Some(status);
                page.amp_target_checked_in_run = true;
                page.amp_target_canonical_alignment = canonical_alignment;
                if status >= 400 || status == 0 {
                    page.issues.push(CrawledPageIssue {
                        severity: "Warning".into(),
                        message: format!("AMP target returned HTTP {status} in this crawl"),
                    });
                }
                if page.amp_target_canonical_alignment.as_deref() == Some("canonical-points-elsewhere")
                {
                    page.issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "AMP target canonical points to a URL other than its source page or itself".into(),
                    });
                }
                if page.amp_target_canonical_alignment.as_deref() == Some("missing-canonical") {
                    page.issues.push(CrawledPageIssue {
                        severity: "Info".into(),
                        message: "AMP target in this crawl has no canonical declaration".into(),
                    });
                }
            }
            None => page.issues.push(CrawledPageIssue {
                severity: "Info".into(),
                message: "AMP target was not included in this crawl; its response and canonical were not verified"
                    .into(),
            }),
        }
        page.issues_count = page.issues.len();
    }
    for page in &mut pages {
        page.issues.extend(validate_hreflang_declarations(
            &page.url,
            &page.final_url,
            &page.hreflangs,
        ));
        for hreflang in &mut page.hreflangs {
            page.issues.extend(annotate_hreflang_target(
                &page.url,
                &page.final_url,
                hreflang,
                &crawled_statuses,
                &hreflang_targets,
                &canonical_targets,
            ));
        }
        page.issues_count = page.issues.len();
    }

    let duplicate_titles = duplicate_text_indices(pages.iter().map(|page| page.title.as_deref()));
    for indices in duplicate_titles {
        for index in indices {
            let page = &mut pages[index];
            page.issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: "Duplicate title found in this crawl".into(),
            });
            page.issues_count = page.issues.len();
        }
    }
    let duplicate_descriptions =
        duplicate_text_indices(pages.iter().map(|page| page.meta_description.as_deref()));
    for indices in duplicate_descriptions {
        for index in indices {
            let page = &mut pages[index];
            page.issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: "Duplicate meta description found in this crawl".into(),
            });
            page.issues_count = page.issues.len();
        }
    }

    let mut descriptions: std::collections::HashMap<String, Vec<usize>> =
        std::collections::HashMap::new();
    for (index, page) in pages.iter().enumerate() {
        if let Some(description) = page
            .meta_description
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            descriptions
                .entry(description.to_ascii_lowercase())
                .or_default()
                .push(index);
        }
    }
    for indices in descriptions
        .into_values()
        .filter(|indices| indices.len() > 1)
    {
        for index in indices {
            let page = &mut pages[index];
            page.issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: "Duplicate meta description found in this crawl".into(),
            });
            page.issues_count = page.issues.len();
        }
    }

    let mut fingerprints: std::collections::HashMap<String, Vec<usize>> =
        std::collections::HashMap::new();
    for (index, page) in pages.iter().enumerate() {
        if let Some(hash) = page.content_hash.as_deref() {
            fingerprints.entry(hash.to_owned()).or_default().push(index);
        }
    }
    for indices in fingerprints
        .into_values()
        .filter(|indices| indices.len() > 1)
    {
        for index in indices {
            let page = &mut pages[index];
            page.issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: "Duplicate normalized page content found in this crawl".into(),
            });
            page.issues_count = page.issues.len();
        }
    }

    let near_duplicate_signatures = pages
        .iter()
        .enumerate()
        .filter(|(_, page)| page.word_count >= 20)
        .filter_map(|(index, page)| {
            page.content_simhash
                .clone()
                .map(|signature| (index, signature))
        })
        .collect::<Vec<_>>();
    for (left, right, distance) in near_duplicate_pairs(&near_duplicate_signatures) {
        if pages[left].content_hash == pages[right].content_hash {
            continue;
        }
        let left_url = pages[left].final_url.clone();
        let right_url = pages[right].final_url.clone();
        pages[left].issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("Near-duplicate content with {right_url} (local SimHash distance {distance}/64; threshold ≤7)"),
        });
        pages[right].issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("Near-duplicate content with {left_url} (local SimHash distance {distance}/64; threshold ≤7)"),
        });
        pages[left].issues_count = pages[left].issues.len();
        pages[right].issues_count = pages[right].issues.len();
    }

    let max_resource_requests = config.max_resource_requests.unwrap_or(250).clamp(1, 1_000);
    let mut ordered_resources = resource_candidates.into_values().collect::<Vec<_>>();
    ordered_resources.sort_by(|left, right| left.url.cmp(&right.url));
    let resource_limit_reached = ordered_resources.len() > max_resource_requests;
    let selected_resources = ordered_resources
        .into_iter()
        .take(max_resource_requests)
        .collect::<Vec<_>>();
    let mut resources = Vec::new();
    // A robots Crawl-delay is a site policy, so retain the strict sequential
    // request cadence whenever it is configured. Without that policy, optional
    // resource requests may use a bounded JoinSet, while page crawling itself
    // remains deterministic and sequential.
    if robots_crawl_delay.is_some() {
        for candidate in selected_resources {
            if crawl_deadline_reached(start_time, max_run_seconds) {
                timed_out = true;
                break;
            }
            if !control.wait_until_resumed(&run_id).await {
                break;
            }
            if let (Some(delay), Some(last_request_at)) = (robots_crawl_delay, last_page_request_at)
            {
                if !wait_for_crawl_delay(control, &run_id, last_request_at, delay).await {
                    break;
                }
            }
            last_page_request_at = Some(Instant::now());
            resources.push(fetch_resource_candidate(client.clone(), candidate).await);
        }
    } else {
        let max_concurrent_requests = config.max_concurrent_requests.unwrap_or(4).clamp(1, 16);
        let mut pending = selected_resources.into_iter();
        let mut tasks = JoinSet::new();
        for _ in 0..max_concurrent_requests {
            if let Some(candidate) = pending.next() {
                tasks.spawn(fetch_resource_candidate(client.clone(), candidate));
            }
        }
        while let Some(joined) = tasks.join_next().await {
            if crawl_deadline_reached(start_time, max_run_seconds) {
                timed_out = true;
                tasks.abort_all();
                break;
            }
            if !control.wait_until_resumed(&run_id).await {
                tasks.abort_all();
                break;
            }
            match joined {
                Ok(resource) => resources.push(resource),
                Err(_) => resources.push(CrawledResource {
                    source_urls: Vec::new(),
                    url: String::new(),
                    resource_type: "other".into(),
                    http_status: None,
                    content_type: None,
                    content_length: None,
                    intrinsic_width: None,
                    intrinsic_height: None,
                    dimensions_source: None,
                    response_time_ms: None,
                    request_error_kind: Some("resource_task".into()),
                }),
            }
            if let Some(candidate) = pending.next() {
                tasks.spawn(fetch_resource_candidate(client.clone(), candidate));
            }
        }
    }
    resources.retain(|resource| !resource.url.is_empty());
    resources.sort_by(|left, right| left.url.cmp(&right.url));

    // Link image rows to the result of an optional resource crawl. Do not
    // synthesize status or byte counts for images that were not requested or
    // fell outside the resource crawl's scope/limit.
    for page in &mut pages {
        apply_checked_image_resources(&mut page.images, &resources, &config);
    }
    apply_checked_social_resources(&mut pages, &resources, &config);
    apply_checked_frame_resources(&mut pages, &resources, &config);

    let critical_count = pages
        .iter()
        .flat_map(|p| &p.issues)
        .filter(|i| i.severity == "Critical")
        .count();

    let warning_count = pages
        .iter()
        .flat_map(|p| &p.issues)
        .filter(|i| i.severity == "Warning")
        .count();

    let notice_count = pages
        .iter()
        .flat_map(|p| &p.issues)
        .filter(|i| i.severity == "Info")
        .count();

    let penalty = (critical_count * 15 + warning_count * 5).min(80);
    let health_score = 100u8.saturating_sub(penalty as u8).max(20);

    let cancelled = control.is_cancelled(&run_id);
    let _ = app.emit(
        "crawl-progress",
        CrawlProgress {
            run_id: run_id.clone(),
            current_url: None,
            discovered: visited.len(),
            completed: pages.len(),
            queued: queue.len() + prefetched_order.len(),
            cancelled,
            paused: false,
            elapsed_ms: start_time.elapsed().as_millis() as u64,
            pages_per_second: {
                let elapsed_seconds = start_time.elapsed().as_secs_f64();
                if elapsed_seconds > 0.0 {
                    pages.len() as f64 / elapsed_seconds
                } else {
                    0.0
                }
            },
        },
    );
    let limit_reasons = {
        let mut reasons = Vec::new();
        if pages.len() >= limit && (!queue.is_empty() || !prefetched_order.is_empty()) {
            reasons.push("max_pages".into());
        }
        if depth_limit_reached {
            reasons.push("max_depth".into());
        }
        if pages.iter().any(|page| page.body_truncated) {
            reasons.push("max_response_bytes".into());
        }
        if timed_out {
            reasons.push("max_run_seconds".into());
        }
        if pages.iter().any(|page| {
            page.issues
                .iter()
                .any(|issue| issue.message.contains("Redirect limit"))
        }) {
            reasons.push("max_redirects".into());
        }
        if resource_limit_reached {
            reasons.push("max_resource_requests".into());
        }
        reasons
    };
    let result = SiteCrawlResult {
        start_url: normalized_start_url.to_string(),
        crawl_mode: config.crawl_mode.clone(),
        pages_crawled: pages.len(),
        health_score,
        critical_count,
        warning_count,
        notice_count,
        pages,
        duration_ms: start_time.elapsed().as_millis() as u64,
        cancelled,
        timed_out,
        robots_txt_status,
        robots_user_agent: ua,
        robots_applicable_rules,
        robots_agent_matrix,
        robots_sitemap_directives,
        robots_blocked_count,
        sitemap_status,
        sitemap_urls_discovered: sitemap_urls.len(),
        sitemap_urls,
        rejected_urls,
        resources,
        resource_limit_reached,
        discovery_provenance_truncated,
        limit_reasons,
    };
    control.finish(&run_id);
    if let Some(session) = rendered_session {
        session.close();
    }
    Ok(result)
}

fn is_valid_hreflang_code(value: &str) -> bool {
    if value.eq_ignore_ascii_case("x-default")
        || [
            "art-lojban",
            "cel-gaulish",
            "en-gb-oed",
            "i-ami",
            "i-bnn",
            "i-default",
            "i-enochian",
            "i-hak",
            "i-klingon",
            "i-lux",
            "i-mingo",
            "i-navajo",
            "i-pwn",
            "i-tao",
            "i-tay",
            "i-tsu",
            "no-bok",
            "no-nyn",
            "sgn-be-fr",
            "sgn-be-nl",
            "sgn-ch-de",
            "zh-guoyu",
            "zh-hakka",
            "zh-min",
            "zh-min-nan",
            "zh-xiang",
        ]
        .iter()
        .any(|tag| value.eq_ignore_ascii_case(tag))
    {
        return true;
    }

    let parts = value.split('-').collect::<Vec<_>>();
    if parts
        .iter()
        .any(|part| part.is_empty() || !part.bytes().all(|byte| byte.is_ascii_alphanumeric()))
    {
        return false;
    }

    let primary = parts[0];
    if !(2..=8).contains(&primary.len()) || !primary.bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        return false;
    }

    let mut index = 1;
    if primary.len() <= 3 {
        let mut extlangs = 0;
        while index < parts.len()
            && extlangs < 3
            && parts[index].len() == 3
            && parts[index].bytes().all(|byte| byte.is_ascii_alphabetic())
        {
            index += 1;
            extlangs += 1;
        }
    }

    if index < parts.len()
        && parts[index].len() == 4
        && parts[index].bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        index += 1;
    }
    if index < parts.len()
        && ((parts[index].len() == 2
            && parts[index].bytes().all(|byte| byte.is_ascii_alphabetic()))
            || (parts[index].len() == 3 && parts[index].bytes().all(|byte| byte.is_ascii_digit())))
    {
        index += 1;
    }

    let mut variants = HashSet::new();
    while index < parts.len() {
        let part = parts[index];
        let variant = (5..=8).contains(&part.len())
            || (part.len() == 4 && part.as_bytes()[0].is_ascii_digit());
        if !variant {
            break;
        }
        if !variants.insert(part.to_ascii_lowercase()) {
            return false;
        }
        index += 1;
    }

    let mut extensions = HashSet::new();
    while index < parts.len() && parts[index].len() == 1 && !parts[index].eq_ignore_ascii_case("x")
    {
        let singleton = parts[index].to_ascii_lowercase();
        if !extensions.insert(singleton) {
            return false;
        }
        index += 1;
        let start = index;
        while index < parts.len() && (2..=8).contains(&parts[index].len()) {
            index += 1;
        }
        if index == start {
            return false;
        }
    }

    if index < parts.len() && parts[index].eq_ignore_ascii_case("x") {
        index += 1;
        let start = index;
        while index < parts.len() && (1..=8).contains(&parts[index].len()) {
            index += 1;
        }
        if index == start {
            return false;
        }
    }

    index == parts.len()
}

fn same_hreflang_url(left: &str, right: &str) -> bool {
    match (url::Url::parse(left), url::Url::parse(right)) {
        (Ok(mut left), Ok(mut right)) => {
            left.set_fragment(None);
            right.set_fragment(None);
            left == right
        }
        _ => false,
    }
}

fn validate_hreflang_declarations(
    url: &str,
    final_url: &str,
    declarations: &[CrawledHreflang],
) -> Vec<CrawledPageIssue> {
    if declarations.is_empty() {
        return Vec::new();
    }
    let mut issues = Vec::new();
    let mut languages = HashSet::new();
    let mut x_default_count = 0;
    let has_self_reference = declarations.iter().any(|item| {
        same_hreflang_url(&item.target_url, url) || same_hreflang_url(&item.target_url, final_url)
    });

    for declaration in declarations {
        if !is_valid_hreflang_code(&declaration.language) {
            issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: format!("Invalid hreflang language tag `{}`", declaration.language),
            });
        }
        let language = declaration.language.to_ascii_lowercase();
        if !languages.insert(language.clone()) {
            issues.push(CrawledPageIssue {
                severity: "Warning".into(),
                message: format!("Duplicate hreflang language tag `{}`", declaration.language),
            });
        }
        if language == "x-default" {
            x_default_count += 1;
        }
    }

    if !has_self_reference {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "Hreflang cluster does not include a self-reference to this page".into(),
        });
    }
    if x_default_count == 0 {
        issues.push(CrawledPageIssue { severity: "Info".into(), message: "No x-default hreflang alternate is declared; add one when a language-neutral destination is available".into() });
    } else if x_default_count > 1 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: "More than one x-default hreflang alternate is declared".into(),
        });
    }

    issues
}

fn annotate_hreflang_target(
    source_url: &str,
    source_final_url: &str,
    target: &mut CrawledHreflang,
    crawled_statuses: &HashMap<String, u16>,
    hreflang_targets: &HashMap<String, HashSet<String>>,
    canonical_targets: &HashMap<String, Option<String>>,
) -> Vec<CrawledPageIssue> {
    let mut issues = Vec::new();
    let Some(status) = crawled_statuses.get(&target.target_url).copied() else {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Hreflang target was not included in this crawl; status and reciprocity were not verified".into(),
        });
        return issues;
    };
    target.target_http_status = Some(status);
    target.target_checked_in_run = true;
    if status == 0 || status >= 400 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("Hreflang target returned HTTP {status} in this crawl"),
        });
    }

    if let Some(reciprocal_targets) = hreflang_targets.get(&target.target_url) {
        let reciprocal = reciprocal_targets.contains(source_url)
            || reciprocal_targets.contains(source_final_url);
        target.reciprocal_in_run = Some(reciprocal);
        if !reciprocal {
            issues.push(CrawledPageIssue {
                severity: "Info".into(),
                message: "Hreflang target has no reciprocal reference in this crawl".into(),
            });
        }
    }

    if let Some(canonical) = canonical_targets.get(&target.target_url) {
        match canonical {
            Some(canonical) if same_hreflang_url(canonical, &target.target_url) => {
                target.target_canonical_alignment = Some("self-canonical".into());
            }
            Some(_) => {
                target.target_canonical_alignment = Some("canonical-points-elsewhere".into());
                issues.push(CrawledPageIssue {
                    severity: "Info".into(),
                    message: "Hreflang target canonical points to another URL".into(),
                });
            }
            None => {
                target.target_canonical_alignment = Some("missing-canonical".into());
                issues.push(CrawledPageIssue {
                    severity: "Info".into(),
                    message: "Hreflang target has no canonical declaration; alignment could not be checked".into(),
                });
            }
        }
    }
    issues
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_crawl_snapshots_default_to_http_mode() {
        let legacy = serde_json::json!({
            "start_url": "https://example.com/",
            "pages_crawled": 0,
            "health_score": 100,
            "critical_count": 0,
            "warning_count": 0,
            "notice_count": 0,
            "pages": [],
            "duration_ms": 0,
            "cancelled": false,
            "timed_out": false,
            "robots_txt_status": "unavailable",
            "robots_blocked_count": 0,
            "sitemap_status": "unavailable",
            "sitemap_urls_discovered": 0,
            "sitemap_urls": [],
            "rejected_urls": [],
            "resources": [],
            "resource_limit_reached": false
        });

        let parsed: SiteCrawlResult = serde_json::from_value(legacy).unwrap();

        assert_eq!(parsed.crawl_mode, "http");
        assert!(!parsed.discovery_provenance_truncated);
        assert!(parsed.limit_reasons.is_empty());
    }

    #[test]
    fn discovery_sources_are_deduplicated_and_bounded() {
        let mut sources_by_url = HashMap::new();
        let source = CrawledDiscoverySource {
            kind: "link".into(),
            source_url: Some("https://example.com/guide".into()),
            anchor_text: Some("Guide".into()),
        };

        assert!(record_discovery_source(
            &mut sources_by_url,
            "https://example.com/target",
            source.clone(),
        ));
        assert!(record_discovery_source(
            &mut sources_by_url,
            "https://example.com/target",
            source
        ));
        let mut dropped = false;
        for index in 0..(MAX_DISCOVERY_SOURCES_PER_PAGE + 4) {
            dropped |= !record_discovery_source(
                &mut sources_by_url,
                "https://example.com/target",
                CrawledDiscoverySource {
                    kind: "link".into(),
                    source_url: Some(format!("https://example.com/source-{index}")),
                    anchor_text: None,
                },
            );
        }
        assert!(dropped, "the provenance cap must be observable by callers");

        let sources = sources_by_url
            .get("https://example.com/target")
            .expect("target provenance should be recorded");
        assert_eq!(sources.len(), MAX_DISCOVERY_SOURCES_PER_PAGE);
        assert_eq!(sources[0].anchor_text.as_deref(), Some("Guide"));
    }

    fn crawl_config_for_test() -> CrawlConfig {
        CrawlConfig {
            crawl_mode: default_http_crawl_mode(),
            render_wait_for_selector: None,
            render_wait_delay_ms: None,
            render_lazy_scroll_cycles: None,
            max_pages: None,
            max_depth: None,
            include_patterns: Vec::new(),
            exclude_patterns: Vec::new(),
            allow_subdomains: false,
            allowed_hosts: Vec::new(),
            scope_path: None,
            keep_query_strings: false,
            respect_robots: true,
            respect_crawl_delay: true,
            discover_sitemaps: true,
            max_redirects: Some(10),
            follow_nofollow: false,
            max_response_bytes: Some(5_000_000),
            max_run_seconds: Some(300),
            request_timeout_secs: None,
            verify_ssl: true,
            seed_urls: Vec::new(),
            list_mode: false,
            user_agent: None,
            request_profile_id: None,
            trim_trailing_slash: false,
            lowercase_path: false,
            strip_tracking_parameters: false,
            allowed_query_parameters: Vec::new(),
            denied_query_parameters: Vec::new(),
            custom_searches: Vec::new(),
            focus_phrase: None,
            crawl_images: false,
            crawl_stylesheets: false,
            crawl_scripts: false,
            crawl_other_resources: false,
            max_resource_requests: Some(250),
            max_concurrent_requests: Some(4),
            resume_completed_urls: Vec::new(),
            resume_frontier_urls: Vec::new(),
        }
    }

    #[test]
    fn rendered_profile_accepts_cookie_only_credentials() {
        let profile = CrawlAuthProfile {
            headers: Vec::new(),
            cookie: Some("session=opaque".into()),
            proxy_url: None,
        };

        assert!(!rendered_profile_has_unsupported_transport(&profile));
    }

    #[test]
    fn rendered_profile_rejects_custom_headers_or_proxy() {
        let with_header = CrawlAuthProfile {
            headers: vec![crate::commands::settings::CrawlProfileHeader {
                name: "Authorization".into(),
                value: "Bearer opaque".into(),
            }],
            cookie: Some("session=opaque".into()),
            proxy_url: None,
        };
        let with_proxy = CrawlAuthProfile {
            headers: Vec::new(),
            cookie: None,
            proxy_url: Some("https://proxy.example".into()),
        };

        assert!(rendered_profile_has_unsupported_transport(&with_header));
        assert!(rendered_profile_has_unsupported_transport(&with_proxy));
    }

    #[test]
    fn intrinsic_favicon_dimensions_decode_largest_ico_entry() {
        let mut bytes = vec![0, 0, 1, 0, 2, 0];
        // 16x16 entry followed by a 32x32 entry. The remaining directory
        // fields are not needed for intrinsic dimensions.
        bytes.extend_from_slice(&[16, 16, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        bytes.extend_from_slice(&[32, 32, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

        assert_eq!(
            intrinsic_http_image_dimensions(Some("image/x-icon"), &bytes),
            Some((32, 32))
        );
    }

    #[test]
    fn favicon_metadata_keeps_bounded_data_image_declarations() {
        let document = Html::parse_document(
            r#"<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20width%3D%2216%22%20height%3D%2216%22%3E%3C/svg%3E">"#,
        );
        let base = url::Url::parse("https://example.com/page").unwrap();

        let metadata = crawl_favicon_metadata(&document, &base);

        assert_eq!(metadata.len(), 1);
        assert!(metadata[0].href.starts_with("data:image/svg+xml,"));
        assert_eq!(metadata[0].declared_type.as_deref(), Some("image/svg+xml"));
        assert_eq!(metadata[0].inferred_format.as_deref(), Some("svg+xml"));
    }

    #[test]
    fn test_crawl_site_ssrf_protection() {
        let result = validate_and_normalize_url("http://127.0.0.1:8080");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("SSRF"));
    }

    #[test]
    fn test_crawl_site_invalid_scheme() {
        let result = validate_and_normalize_url("ftp://example.com");
        assert!(result.is_err());
    }

    #[test]
    fn duplicate_heading_detection_normalizes_whitespace_and_case_and_keeps_levels() {
        let document = Html::parse_document(
            "<h2> Quick   Start </h2><h3>quick start</h3><h2>QUICK START</h2><h4>Other</h4><h5> </h5>",
        );
        let selector = Selector::parse("h1, h2, h3, h4, h5, h6").unwrap();

        let duplicates = duplicate_heading_groups(&document, &selector);

        assert_eq!(duplicates.len(), 1);
        assert_eq!(duplicates[0].text, "Quick Start");
        assert_eq!(duplicates[0].levels, vec![2, 3]);
        assert_eq!(duplicates[0].occurrences, 3);
    }

    #[test]
    fn crawl_control_pauses_and_resumes_the_same_run() {
        let control = CrawlControl::new();
        control.start("run-1");
        control.pause("run-1");
        assert!(control.is_paused("run-1"));
        assert!(!control.is_cancelled("run-1"));

        control.resume("run-1");
        assert!(!control.is_paused("run-1"));
    }

    #[tokio::test]
    async fn http_prefetch_keeps_robots_blocked_pages_in_order_without_fetching_them() {
        let mut queue = VecDeque::from([
            ("http://127.0.0.1:9/blocked".to_string(), 0),
            ("http://127.0.0.1:9/allowed".to_string(), 0),
        ]);
        let mut prefetched_order = VecDeque::new();
        let mut prefetched_responses = HashMap::new();
        let client = reqwest::Client::builder()
            .no_proxy()
            .connect_timeout(std::time::Duration::from_millis(100))
            .build()
            .expect("test client should build");
        let config = crawl_config_for_test();

        prefetch_http_pages(
            &mut queue,
            &mut prefetched_order,
            &mut prefetched_responses,
            4,
            10,
            0,
            &client,
            "127.0.0.1",
            false,
            None,
            &[],
            10,
            &config,
            &[RobotsRule {
                allow: false,
                path: "/blocked".into(),
            }],
        )
        .await;

        assert_eq!(
            prefetched_order.into_iter().collect::<Vec<_>>(),
            vec![
                ("http://127.0.0.1:9/blocked".into(), 0),
                ("http://127.0.0.1:9/allowed".into(), 0),
            ]
        );
        assert!(
            !prefetched_responses.contains_key("http://127.0.0.1:9/blocked"),
            "robots-disallowed URLs must be handled by the main loop"
        );
        assert!(
            prefetched_responses.contains_key("http://127.0.0.1:9/allowed"),
            "allowed URLs should receive a bounded prefetch result"
        );
        assert!(queue.is_empty());
    }

    #[test]
    fn redirect_loop_guard_rejects_a_repeated_target() {
        let mut seen = HashSet::from(["https://example.com/a".to_string()]);
        assert!(redirect_target_is_new(&mut seen, "https://example.com/b"));
        assert!(!redirect_target_is_new(&mut seen, "https://example.com/a"));
    }

    #[test]
    fn redirect_hop_timing_is_optional_for_legacy_snapshots() {
        let hop = CrawledRedirectHop {
            from_url: "https://example.com/old".into(),
            http_status: 301,
            to_url: "https://example.com/new".into(),
            response_time_ms: Some(42),
        };
        let encoded = serde_json::to_value(&hop).unwrap();
        assert_eq!(encoded["response_time_ms"], serde_json::json!(42));

        let legacy: CrawledRedirectHop = serde_json::from_value(serde_json::json!({
            "from_url": "https://example.com/old",
            "http_status": 301,
            "to_url": "https://example.com/new"
        }))
        .unwrap();
        assert_eq!(legacy.response_time_ms, None);
    }

    #[test]
    fn canonical_target_is_resolved_against_the_final_url() {
        let final_url = url::Url::parse("https://example.com/path/page").unwrap();
        assert_eq!(
            final_url.join("/canonical").unwrap().as_str(),
            "https://example.com/canonical"
        );
    }

    #[test]
    fn canonical_classification_reports_missing_declaration() {
        assert_eq!(
            classify_canonical_relation("https://example.com/", 0, &[]),
            "missing"
        );
    }

    #[test]
    fn canonical_extraction_counts_multiple_and_missing_href_declarations() {
        let document = Html::parse_document(
            r#"<link rel="canonical" href="/one"><link rel="alternate canonical">"#,
        );
        let base = url::Url::parse("https://example.com/page").unwrap();
        let (count, targets) = crawl_canonical_declarations(&document, &base);

        assert_eq!(count, 2);
        assert_eq!(targets, vec!["https://example.com/one"]);
        assert_eq!(
            classify_canonical_relation(base.as_str(), count, &targets),
            "multiple"
        );
    }

    #[test]
    fn canonical_extraction_rejects_non_http_and_empty_targets_as_invalid() {
        for markup in [
            r#"<link rel="canonical" href="javascript:alert(1)">"#,
            r#"<link rel="canonical" href="  ">"#,
        ] {
            let document = Html::parse_document(markup);
            let base = url::Url::parse("https://example.com/page").unwrap();
            let (count, targets) = crawl_canonical_declarations(&document, &base);

            assert_eq!(count, 1);
            assert!(targets.is_empty());
            assert_eq!(
                classify_canonical_relation(base.as_str(), count, &targets),
                "invalid"
            );
        }
    }

    #[test]
    fn canonical_classification_ignores_fragment_when_identifying_self_reference() {
        assert_eq!(
            classify_canonical_relation(
                "https://example.com/page?lang=pl",
                1,
                &["https://example.com/page?lang=pl#section".into()]
            ),
            "self"
        );
    }

    #[test]
    fn canonical_identity_normalizes_safe_equivalent_url_spellings() {
        assert_eq!(
            classify_canonical_relation(
                "https://EXAMPLE.com:443/%7Euser",
                1,
                &["https://example.com/~user".into()],
            ),
            "self"
        );
    }

    #[test]
    fn canonical_identity_keeps_reserved_path_escapes_distinct() {
        assert_eq!(
            classify_canonical_relation(
                "https://example.com/a%2Fb",
                1,
                &["https://example.com/a/b".into()],
            ),
            "same-host-other-url"
        );
    }

    #[test]
    fn crawl_url_identity_normalizes_unreserved_escapes_without_sorting_query() {
        let mut config = crawl_config_for_test();
        config.keep_query_strings = true;
        let encoded = normalize_crawl_url(
            url::Url::parse("https://example.com/%7e?a=2&b=1").unwrap(),
            &config,
        );
        let literal = normalize_crawl_url(
            url::Url::parse("https://example.com/~?a=2&b=1").unwrap(),
            &config,
        );
        assert_eq!(encoded, literal);

        let reordered = normalize_crawl_url(
            url::Url::parse("https://example.com/~?b=1&a=2").unwrap(),
            &config,
        );
        assert_ne!(encoded, reordered);
    }

    #[test]
    fn canonical_classification_distinguishes_other_url_on_same_host() {
        assert_eq!(
            classify_canonical_relation(
                "https://example.com/page",
                1,
                &["https://example.com/canonical".into()]
            ),
            "same-host-other-url"
        );
    }

    #[test]
    fn canonical_classification_distinguishes_a_different_host() {
        assert_eq!(
            classify_canonical_relation(
                "https://example.com/page",
                1,
                &["https://other.example/page".into()]
            ),
            "different-host"
        );
    }

    #[test]
    fn canonical_target_status_is_set_only_when_target_is_in_the_same_run() {
        let statuses = HashMap::from([("https://example.com/canonical".into(), 404)]);
        let mut crawled = CrawledCanonicalTarget {
            url: "https://example.com/canonical".into(),
            relation: "same-host-other-url".into(),
            http_status: None,
            checked_in_run: false,
        };
        let mut not_crawled = CrawledCanonicalTarget {
            url: "https://example.com/outside-run".into(),
            relation: "same-host-other-url".into(),
            http_status: None,
            checked_in_run: false,
        };

        assert_eq!(verify_canonical_target(&mut crawled, &statuses), Some(404));
        assert_eq!(crawled.http_status, Some(404));
        assert!(crawled.checked_in_run);
        assert_eq!(verify_canonical_target(&mut not_crawled, &statuses), None);
        assert_eq!(not_crawled.http_status, None);
        assert!(!not_crawled.checked_in_run);
    }

    #[test]
    fn refresh_declarations_resolve_http_targets_and_preserve_invalid_evidence() {
        let base = url::Url::parse("https://example.com/articles/page").unwrap();
        let meta = parse_client_redirect("meta-refresh", "0; URL='/next'", &base);
        assert_eq!(meta.source, "meta-refresh");
        assert_eq!(meta.delay_seconds, Some(0.0));
        assert_eq!(meta.target_url.as_deref(), Some("https://example.com/next"));

        let header = parse_client_redirect("http-refresh", "5.5; url=\"../new\"", &base);
        assert_eq!(header.delay_seconds, Some(5.5));
        assert_eq!(
            header.target_url.as_deref(),
            Some("https://example.com/new")
        );

        let invalid = parse_client_redirect("http-refresh", "-1; url=javascript:alert(1)", &base);
        assert_eq!(invalid.delay_seconds, None);
        assert_eq!(invalid.target_url, None);
        assert_eq!(invalid.declaration, "-1; url=javascript:alert(1)");
    }

    #[test]
    fn javascript_redirects_capture_literal_targets_without_executing_scripts() {
        let document = Html::parse_document(
            r#"
              <script>window.location.href = '/next';</script>
              <script>location.replace("https://example.com/final");</script>
              <script type="module">location.assign('/module');</script>
              <script>self.location = `/template`; top.location.replace(`https://example.com/template-final`);</script>
              <script type="application/ld+json">{"location":"/not-a-redirect"}</script>
              <script>location.assign(destination); location.href = protocol + '/dynamic';</script>
              <button onclick="location.href='/clicked'">Go</button>
            "#,
        );
        let base = url::Url::parse("https://example.com/articles/page").unwrap();

        let redirects = extract_javascript_redirects(&document, &base);

        assert_eq!(redirects.len(), 6);
        assert_eq!(
            redirects
                .iter()
                .filter(|item| item.source == "javascript")
                .count(),
            5
        );
        assert_eq!(
            redirects
                .iter()
                .filter(|item| item.source == "javascript-inline")
                .count(),
            1
        );
        assert_eq!(
            redirects[0].target_url.as_deref(),
            Some("https://example.com/next")
        );
        assert_eq!(
            redirects[1].target_url.as_deref(),
            Some("https://example.com/final")
        );
        assert_eq!(
            redirects[2].target_url.as_deref(),
            Some("https://example.com/module")
        );
        assert_eq!(
            redirects[3].target_url.as_deref(),
            Some("https://example.com/template")
        );
        assert_eq!(
            redirects[4].target_url.as_deref(),
            Some("https://example.com/template-final")
        );
        assert_eq!(
            redirects[5].target_url.as_deref(),
            Some("https://example.com/clicked")
        );
        assert!(redirects[0].declaration.contains("location.href"));
        assert!(redirects[1].declaration.contains("location.replace"));
    }

    #[test]
    fn pagination_extraction_preserves_relations_invalid_declarations_and_query_changes() {
        let document = Html::parse_document(
            r#"<link rel="next" href="?page=2&amp;lang=pl"><a rel="prev" href="?page=0&amp;lang=pl">previous</a><link rel="next"><a rel="prev" href="javascript:alert(1)">broken</a>"#,
        );
        let base = url::Url::parse("https://example.com/articles?page=1&lang=pl").unwrap();
        let (links, declaration_count, invalid_count) = crawl_pagination_links(&document, &base);

        assert_eq!(declaration_count, 4);
        assert_eq!(invalid_count, 2);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0].relation, "next");
        assert_eq!(
            links[0].target_url,
            "https://example.com/articles?page=2&lang=pl"
        );
        assert_eq!(links[0].query_parameter_changes, vec!["page: 1 → 2"]);
        assert_eq!(links[1].relation, "prev");
        assert_eq!(links[1].query_parameter_changes, vec!["page: 1 → 0"]);
    }

    #[test]
    fn pagination_query_changes_preserve_duplicate_parameter_values() {
        let source = url::Url::parse("https://example.com/items?tag=one&tag=two&sort=asc").unwrap();
        let target =
            url::Url::parse("https://example.com/items?tag=one&tag=three&sort=asc").unwrap();

        assert_eq!(
            pagination_query_changes(&source, &target),
            vec!["tag: one, two → one, three"]
        );
    }

    #[test]
    fn pagination_reciprocity_uses_the_opposite_relation() {
        assert_eq!(opposite_pagination_relation("next"), Some("prev"));
        assert_eq!(opposite_pagination_relation("PREV"), Some("next"));
        assert_eq!(opposite_pagination_relation("alternate"), None);
    }

    #[test]
    fn pagination_canonical_alignment_is_explicit_and_uses_current_page_canonical_signal() {
        assert_eq!(
            pagination_canonical_alignment("self").as_deref(),
            Some("self-canonical")
        );
        assert_eq!(
            pagination_canonical_alignment("same-host-other-url").as_deref(),
            Some("canonical-points-elsewhere")
        );
        assert_eq!(
            pagination_canonical_alignment("missing").as_deref(),
            Some("missing-canonical")
        );
        assert_eq!(pagination_canonical_alignment("unavailable"), None);
    }

    #[test]
    fn pagination_target_status_is_set_only_when_target_is_in_the_same_run() {
        let statuses = HashMap::from([("https://example.com/page/2".into(), 200)]);
        let mut crawled = CrawledPaginationLink {
            relation: "next".into(),
            target_url: "https://example.com/page/2".into(),
            query_parameter_changes: Vec::new(),
            http_status: None,
            checked_in_run: false,
            reciprocal_in_run: None,
        };
        let mut not_crawled = CrawledPaginationLink {
            relation: "prev".into(),
            target_url: "https://example.com/page/0".into(),
            query_parameter_changes: Vec::new(),
            http_status: None,
            checked_in_run: false,
            reciprocal_in_run: None,
        };

        assert_eq!(verify_pagination_target(&mut crawled, &statuses), Some(200));
        assert_eq!(crawled.http_status, Some(200));
        assert!(crawled.checked_in_run);
        assert_eq!(verify_pagination_target(&mut not_crawled, &statuses), None);
        assert_eq!(not_crawled.http_status, None);
        assert!(!not_crawled.checked_in_run);
    }

    #[test]
    fn duplicate_text_detection_trims_and_normalizes_case_while_ignoring_empty_fields() {
        let duplicates = duplicate_text_indices([
            Some(" Shared description "),
            None,
            Some("shared description"),
            Some(""),
            Some("Different description"),
        ]);

        assert_eq!(duplicates.len(), 1);
        assert_eq!(duplicates[0], vec![0, 2]);
    }

    #[test]
    fn hreflang_language_tags_accept_bcp47_script_region_and_extensions() {
        for valid in [
            "pl",
            "en-GB",
            "zh-Hant-TW",
            "es-419",
            "de-CH-1901",
            "en-a-foo-x-bar",
            "i-klingon",
            "x-default",
        ] {
            assert!(
                is_valid_hreflang_code(valid),
                "expected {valid} to be valid"
            );
        }
        for invalid in ["", "en-", "en-US-US", "en-a", "en-x", "en-abc-def-ghi-jkl"] {
            assert!(
                !is_valid_hreflang_code(invalid),
                "expected {invalid} to be invalid"
            );
        }
    }

    #[test]
    fn hreflang_declarations_report_duplicates_missing_self_and_default() {
        let declarations = vec![
            CrawledHreflang {
                language: "en".into(),
                target_url: "https://example.com/en".into(),
                target_http_status: None,
                target_checked_in_run: false,
                reciprocal_in_run: None,
                target_canonical_alignment: None,
            },
            CrawledHreflang {
                language: "EN".into(),
                target_url: "https://example.com/en-us".into(),
                target_http_status: None,
                target_checked_in_run: false,
                reciprocal_in_run: None,
                target_canonical_alignment: None,
            },
        ];
        let issues = validate_hreflang_declarations(
            "https://example.com/pl",
            "https://example.com/pl/",
            &declarations,
        );
        let messages = issues
            .iter()
            .map(|issue| issue.message.as_str())
            .collect::<Vec<_>>();
        assert!(messages
            .iter()
            .any(|message| message.contains("Duplicate hreflang")));
        assert!(messages
            .iter()
            .any(|message| message.contains("self-reference")));
        assert!(messages.iter().any(|message| message.contains("x-default")));
    }

    #[test]
    fn hreflang_declarations_accept_self_reference_to_final_url_and_single_default() {
        let declarations = vec![
            CrawledHreflang {
                language: "pl".into(),
                target_url: "https://example.com/pl/".into(),
                target_http_status: None,
                target_checked_in_run: false,
                reciprocal_in_run: None,
                target_canonical_alignment: None,
            },
            CrawledHreflang {
                language: "x-default".into(),
                target_url: "https://example.com/".into(),
                target_http_status: None,
                target_checked_in_run: false,
                reciprocal_in_run: None,
                target_canonical_alignment: None,
            },
        ];
        let issues = validate_hreflang_declarations(
            "https://example.com/pl",
            "https://example.com/pl/",
            &declarations,
        );
        assert!(issues.is_empty());
    }

    #[test]
    fn hreflang_target_annotation_records_status_reciprocity_and_canonical_alignment() {
        let target_url = "https://example.com/en/".to_string();
        let statuses = HashMap::from([(target_url.clone(), 200)]);
        let reciprocal = HashMap::from([(
            target_url.clone(),
            HashSet::from(["https://example.com/pl/".to_string()]),
        )]);
        let canonicals = HashMap::from([(target_url.clone(), Some(target_url.clone()))]);
        let mut target = CrawledHreflang {
            language: "en".into(),
            target_url,
            target_http_status: None,
            target_checked_in_run: false,
            reciprocal_in_run: None,
            target_canonical_alignment: None,
        };

        let issues = annotate_hreflang_target(
            "https://example.com/pl",
            "https://example.com/pl/",
            &mut target,
            &statuses,
            &reciprocal,
            &canonicals,
        );

        assert!(issues.is_empty());
        assert_eq!(target.target_http_status, Some(200));
        assert!(target.target_checked_in_run);
        assert_eq!(target.reciprocal_in_run, Some(true));
        assert_eq!(
            target.target_canonical_alignment.as_deref(),
            Some("self-canonical")
        );
    }

    #[test]
    fn hreflang_target_annotation_reports_broken_nonreciprocal_and_misaligned_target() {
        let target_url = "https://example.com/en/".to_string();
        let statuses = HashMap::from([(target_url.clone(), 404)]);
        let reciprocal = HashMap::from([(target_url.clone(), HashSet::new())]);
        let canonicals = HashMap::from([(
            target_url.clone(),
            Some("https://example.com/en/landing".to_string()),
        )]);
        let mut target = CrawledHreflang {
            language: "en".into(),
            target_url,
            target_http_status: None,
            target_checked_in_run: false,
            reciprocal_in_run: None,
            target_canonical_alignment: None,
        };

        let issues = annotate_hreflang_target(
            "https://example.com/pl",
            "https://example.com/pl/",
            &mut target,
            &statuses,
            &reciprocal,
            &canonicals,
        );

        assert_eq!(target.target_http_status, Some(404));
        assert!(target.target_checked_in_run);
        assert_eq!(target.reciprocal_in_run, Some(false));
        assert_eq!(
            target.target_canonical_alignment.as_deref(),
            Some("canonical-points-elsewhere")
        );
        assert_eq!(issues.len(), 3);
    }

    #[test]
    fn hreflang_target_annotation_keeps_external_targets_explicitly_unverified() {
        let mut target = CrawledHreflang {
            language: "en".into(),
            target_url: "https://outside.example/en/".into(),
            target_http_status: None,
            target_checked_in_run: false,
            reciprocal_in_run: None,
            target_canonical_alignment: None,
        };
        let issues = annotate_hreflang_target(
            "https://example.com/pl",
            "https://example.com/pl/",
            &mut target,
            &HashMap::new(),
            &HashMap::new(),
            &HashMap::new(),
        );

        assert_eq!(target.target_http_status, None);
        assert!(!target.target_checked_in_run);
        assert_eq!(target.reciprocal_in_run, None);
        assert_eq!(target.target_canonical_alignment, None);
        assert!(issues[0].message.contains("not included in this crawl"));
    }

    #[test]
    fn amp_target_verification_returns_status_and_bounded_scope_for_targets_in_the_run() {
        let statuses = HashMap::from([("https://example.com/amp/".into(), 404)]);

        assert_eq!(
            verify_amp_target(
                "https://example.com/",
                "https://example.com/",
                "https://example.com/amp/",
                &statuses,
                &HashMap::new(),
            ),
            (Some(404), None)
        );
        assert_eq!(
            verify_amp_target(
                "https://example.com/",
                "https://example.com/",
                "https://example.com/amp-outside-run/",
                &statuses,
                &HashMap::new(),
            ),
            (None, None)
        );
    }

    #[test]
    fn amp_target_verification_reports_canonical_alignment_from_the_same_run() {
        let statuses = HashMap::from([("https://example.com/amp/".into(), 200)]);
        let source_canonical = HashMap::from([(
            "https://example.com/amp/".into(),
            Some("https://example.com/article".into()),
        )]);
        assert_eq!(
            verify_amp_target(
                "https://example.com/article",
                "https://example.com/article",
                "https://example.com/amp/",
                &statuses,
                &source_canonical,
            ),
            (Some(200), Some("canonical-to-source".into()))
        );

        let self_canonical = HashMap::from([(
            "https://example.com/amp/".into(),
            Some("https://example.com/amp/".into()),
        )]);
        assert_eq!(
            verify_amp_target(
                "https://example.com/article",
                "https://example.com/article",
                "https://example.com/amp/",
                &statuses,
                &self_canonical,
            ),
            (Some(200), Some("self-canonical".into()))
        );
    }

    #[test]
    fn content_metrics_returns_ratio_and_reading_time_for_html() {
        let document = Html::parse_document("<html><body>one two three</body></html>");
        let metrics = content_metrics(&document, 50, Some("en"));
        assert_eq!(metrics.word_count, 3);
        assert!(metrics.text_ratio_percent.is_some_and(|value| value > 0.0));
        assert_eq!(metrics.reading_time_minutes, Some(1));
        assert_eq!(metrics.sentence_count, Some(1));
        assert_eq!(metrics.average_words_per_sentence, Some(3.0));
        assert!(metrics
            .average_characters_per_word
            .is_some_and(|value| value > 3.0));
        assert_eq!(metrics.complexity_score, Some(100));
        assert_eq!(metrics.complexity_label.as_deref(), Some("simple"));
        assert!(metrics.readability_ease_score.is_some());
        assert!(metrics.readability_grade.is_some());
        assert!(metrics.readability_label.is_some());
    }

    #[test]
    fn content_metrics_uses_document_language_for_readability() {
        let document = Html::parse_document(
            "<html lang=\"pl\"><body><main>To jest przykładowy tekst, który pokazuje polską formułę czytelności. Zdanie ma kilka słów i powinno otrzymać lokalny wzór.</main></body></html>",
        );
        let polish = content_metrics(&document, 220, Some("pl-PL"));
        let english = content_metrics(&document, 220, Some("en-US"));

        assert_eq!(polish.readability_method.as_deref(), Some("flesch-pl"));
        assert_eq!(english.readability_method.as_deref(), Some("flesch-en"));
        assert_ne!(
            polish.readability_ease_score, english.readability_ease_score,
            "Polish text must not silently use the English coefficient"
        );
    }

    #[test]
    fn content_metrics_infers_polish_when_lang_is_missing() {
        let document = Html::parse_document(
            "<html><body><main>To jest tekst, który pokazuje polską treść. Jest to kolejny fragment, który ma lokalny wzór.</main></body></html>",
        );
        let metrics = content_metrics(&document, 220, None);

        assert_eq!(metrics.readability_method.as_deref(), Some("flesch-pl"));
    }

    #[test]
    fn content_metrics_excludes_site_chrome_from_content_signals() {
        let document = Html::parse_document(
            "<html><body><header>navigation words</header><aside>sidebar words</aside><main><p>one two three.</p></main><footer>footer words</footer></body></html>",
        );
        let metrics = content_metrics(&document, 180, Some("en"));

        assert_eq!(metrics.word_count, 3);
        assert_eq!(metrics.sentence_count, Some(1));
        assert_eq!(metrics.average_words_per_sentence, Some(3.0));
        let expected =
            Html::parse_document("<html><body><main>one two three.</main></body></html>");
        assert_eq!(
            metrics.content_hash,
            normalized_content_fingerprint(&expected).1
        );
    }

    #[test]
    fn content_metrics_reports_bounded_term_density() {
        let document = Html::parse_document(
            "<html><body><header>espresso navigation</header><main>espresso espresso brewing coffee</main><footer>espresso footer</footer></body></html>",
        );
        let metrics = content_metrics(&document, 150, Some("en"));

        assert_eq!(
            metrics.content_terms.first().map(|term| term.term.as_str()),
            Some("espresso")
        );
        assert_eq!(
            metrics.content_terms.first().map(|term| term.count),
            Some(2)
        );
        assert!(metrics
            .content_terms
            .first()
            .is_some_and(|term| (term.density_percent - 50.0).abs() < 0.01));
        assert!(!metrics
            .content_terms
            .iter()
            .any(|term| term.term == "navigation"));
    }

    #[test]
    fn focus_phrase_evidence_reports_content_and_metadata_locations() {
        let document = Html::parse_document(
            "<html><head><title>Technical SEO audit</title><meta name=\"description\" content=\"Technical SEO audit guide\"></head><body><header>Technical SEO audit navigation</header><main><h1>Technical SEO audit</h1><p>Technical SEO audit helps teams find issues.</p></main></body></html>",
        );
        let evidence = focus_phrase_evidence(
            &document,
            Some("Technical SEO audit"),
            Some("Technical SEO audit guide"),
            Some("technical seo audit"),
        )
        .expect("phrase evidence should be available");

        assert_eq!(evidence.body_occurrences, 2);
        assert_eq!(evidence.title_occurrences, 1);
        assert_eq!(evidence.meta_description_occurrences, 1);
        assert_eq!(evidence.h1_occurrences, 1);
        assert!(evidence.body_density_percent > 0.0);
    }

    #[test]
    fn semantic_extraction_uses_main_content_and_excludes_site_chrome() {
        let document = Html::parse_document(
            r#"<html><body><header><nav><a href="/global">globalnavigation</a></nav></header><aside class="sidebar">sidebarkeyword</aside><main><h1>Espresso brewing</h1><article><p>Espresso brewing requires precise grinding and fresh coffee beans.</p><a href="/grinding">grinding guide</a></article><form><label>formkeyword</label></form><div role="search">searchformkeyword</div><footer>footerkeyword</footer></main><footer>sitefooterkeyword</footer></body></html>"#,
        );
        let terms = extract_semantic_terms(&document);
        let excerpts = extract_semantic_excerpts(&document);
        assert!(terms.contains(&"espresso".to_string()));
        assert!(terms.contains(&"grinding".to_string()));
        assert!(excerpts
            .iter()
            .any(|excerpt| excerpt.contains("Espresso brewing requires precise grinding")));
        assert!(!terms.contains(&"globalnavigation".to_string()));
        assert!(!terms.contains(&"sidebarkeyword".to_string()));
        assert!(!terms.contains(&"footerkeyword".to_string()));
        assert!(!terms.contains(&"formkeyword".to_string()));
        assert!(!terms.contains(&"searchformkeyword".to_string()));
        assert!(!excerpts
            .iter()
            .any(|excerpt| excerpt.contains("globalnavigation")));
        assert!(!excerpts
            .iter()
            .any(|excerpt| excerpt.contains("footerkeyword")));
        assert!(!terms.contains(&"sitefooterkeyword".to_string()));

        let anchor_selector = Selector::parse("a").unwrap();
        let anchors = document.select(&anchor_selector).collect::<Vec<_>>();
        assert!(!semantic_content_contains(&anchors[0], true));
        assert!(semantic_content_contains(&anchors[1], true));

        let fallback_document = Html::parse_document(
            r#"<html><body><header>globalheaderterm</header><nav>globalnavigationterm</nav><div class="sidebar">sidebarkeyword</div><p>Fallback article content discusses espresso machines and coffee extraction.</p><footer>globalfooterterm</footer></body></html>"#,
        );
        let fallback_terms = extract_semantic_terms(&fallback_document);
        let fallback_excerpts = extract_semantic_excerpts(&fallback_document);
        assert!(fallback_terms.contains(&"espresso".to_string()));
        assert!(fallback_excerpts
            .iter()
            .any(|excerpt| excerpt.contains("Fallback article content discusses espresso")));
        assert!(!fallback_terms.contains(&"globalheaderterm".to_string()));
        assert!(!fallback_terms.contains(&"globalnavigationterm".to_string()));
        assert!(!fallback_terms.contains(&"sidebarkeyword".to_string()));
        assert!(!fallback_terms.contains(&"globalfooterterm".to_string()));
    }

    #[test]
    fn link_source_excerpt_is_bounded_and_redacts_values_and_handlers() {
        let document = Html::parse_document(
            r#"<html><body><main><a href="/broken" value="secret-value" onclick="sendSecret()">Broken destination</a></main></body></html>"#,
        );
        let anchor = document
            .select(&Selector::parse("a").unwrap())
            .next()
            .expect("anchor fixture should exist");
        let excerpt = bounded_link_source_excerpt(&anchor).expect("excerpt should exist");
        assert!(excerpt.contains("/broken"));
        assert!(excerpt.contains("[redacted]"));
        assert!(!excerpt.contains("secret-value"));
        assert!(!excerpt.contains("sendSecret"));
        assert!(excerpt.chars().count() <= 800);
    }

    #[test]
    fn semantic_extraction_handles_rendered_dom_visibility_and_dynamic_chrome() {
        // This mirrors the HTML captured after a browser-rendered page has
        // hydrated. Dynamic content belongs to <main>; consent/navigation
        // fragments and hidden app shells must not influence semantic terms,
        // excerpts, or content-only graph links.
        let rendered_dom = r#"
            <html><body>
              <header><p>headerchromemarker</p></header>
              <nav><a href="/nav">navchromemarker</a></nav>
              <aside><p>sidebarchromemarker</p></aside>
              <div class="cookie-consent"><p>consentchromemarker</p></div>
              <main>
                <h1>Dynamic semantic content</h1>
                <p>Hydrated content about technical audits and crawl diagnostics.</p>
                <a href="/guide">Read the crawl diagnostics guide</a>
                <div hidden><p>hiddeninjectedmarker</p><a href="/hidden">hidden link</a></div>
                <div inert><p>inertinjectedmarker</p><a href="/inert">inert link</a></div>
                <div aria-hidden="1"><p>ariahiddenmarker</p><a href="/aria-hidden">aria hidden link</a></div>
                <div style="display:none!important"><p>displaynonemarker</p><a href="/display-none">display none link</a></div>
                <div style="visibility: hidden"><p>visibilityhiddenmarker</p><a href="/visibility-hidden">visibility hidden link</a></div>
                <div style="content-visibility:hidden"><p>contenthiddenmarker</p><a href="/content-hidden">content hidden link</a></div>
              </main>
              <footer><p>dynamic footer keyword</p></footer>
            </body></html>
        "#;
        let document = Html::parse_document(rendered_dom);
        let terms = extract_semantic_terms(&document);
        let excerpts = extract_semantic_excerpts(&document);
        assert!(terms.contains(&"hydrated".to_string()));
        assert!(terms.contains(&"diagnostics".to_string()));
        for excluded in [
            "headerchromemarker",
            "navchromemarker",
            "sidebarchromemarker",
            "consentchromemarker",
            "hiddeninjectedmarker",
            "inertinjectedmarker",
            "ariahiddenmarker",
            "displaynonemarker",
            "visibilityhiddenmarker",
            "contenthiddenmarker",
        ] {
            assert!(!terms.contains(&excluded.to_string()), "{excluded}");
        }
        assert!(excerpts
            .iter()
            .any(|excerpt| excerpt.contains("Hydrated content about technical audits")));
        assert!(!excerpts
            .iter()
            .any(|excerpt| excerpt.contains("hiddeninjectedmarker")));

        let anchor_selector = Selector::parse("a").unwrap();
        let anchors = document.select(&anchor_selector).collect::<Vec<_>>();
        assert!(anchors
            .iter()
            .any(|anchor| anchor.value().attr("href") == Some("/guide")
                && semantic_content_contains(anchor, true)));
        for hidden_href in [
            "/nav",
            "/hidden",
            "/inert",
            "/aria-hidden",
            "/display-none",
            "/visibility-hidden",
            "/content-hidden",
        ] {
            let anchor = anchors
                .iter()
                .find(|anchor| anchor.value().attr("href") == Some(hidden_href))
                .expect("fixture link should exist");
            assert!(!semantic_content_contains(anchor, true), "{hidden_href}");
        }
        assert_eq!(
            semantic_content_source(&document, true, false, false),
            "primary-root"
        );
    }

    #[test]
    fn hidden_primary_root_does_not_suppress_visible_body_fallback() {
        let document = Html::parse_document(
            r#"<html><body><main hidden><p>hidden primary root term</p></main><div><p>Visible fallback article content.</p></div></body></html>"#,
        );
        assert!(!has_semantic_content_root(&document));
        let terms = extract_semantic_terms(&document);
        assert!(terms.contains(&"visible".to_string()));
        assert!(!terms.contains(&"hidden".to_string()));
        assert_eq!(
            semantic_content_source(&document, true, false, false),
            "body-fallback"
        );
    }

    #[test]
    fn semantic_source_identifies_primary_fallback_and_unavailable_documents() {
        let primary =
            Html::parse_document("<html><body><main><p>Rendered content</p></main></body></html>");
        assert_eq!(
            semantic_content_source(&primary, true, false, false),
            "primary-root"
        );

        let fallback = Html::parse_document(
            "<html><body><div><p>Rendered fallback content</p></div></body></html>",
        );
        assert_eq!(
            semantic_content_source(&fallback, true, false, false),
            "body-fallback"
        );

        assert_eq!(
            semantic_content_source(&primary, false, false, false),
            "unavailable"
        );
        assert_eq!(
            semantic_content_source(&primary, true, true, false),
            "unavailable"
        );
        assert_eq!(
            semantic_content_source(&primary, true, false, true),
            "unavailable"
        );
    }

    #[test]
    fn semantic_provenance_distinguishes_rendered_and_http_snapshots() {
        assert_eq!(
            semantic_provenance_for_mode("browser-rendered", "primary-root"),
            "rendered"
        );
        assert_eq!(
            semantic_provenance_for_mode("http", "body-fallback"),
            "http"
        );
        assert_eq!(
            semantic_provenance_for_mode("browser-rendered", "unavailable"),
            "unavailable"
        );
    }

    #[test]
    fn semantic_partial_flag_is_conservative_at_each_bound() {
        assert!(!semantic_content_is_partial(false, false, 39, 7, 999));
        assert!(semantic_content_is_partial(true, false, 0, 0, 0));
        assert!(semantic_content_is_partial(false, true, 0, 0, 0));
        assert!(semantic_content_is_partial(false, false, 40, 0, 0));
        assert!(semantic_content_is_partial(false, false, 0, 8, 0));
        assert!(semantic_content_is_partial(false, false, 0, 0, 1_000));
    }

    #[test]
    fn scope_respects_subdomain_setting() {
        let child = url::Url::parse("https://docs.example.com/guide").unwrap();
        assert!(!matches_scope(&child, "example.com", false, None, &[]));
        assert!(matches_scope(&child, "example.com", true, None, &[]));
    }

    #[test]
    fn scope_limits_crawling_to_the_selected_directory() {
        let kept = url::Url::parse("https://example.com/docs/guide").unwrap();
        let excluded = url::Url::parse("https://example.com/blog/post").unwrap();
        let near_match = url::Url::parse("https://example.com/docs-old").unwrap();
        assert!(matches_scope(
            &kept,
            "example.com",
            false,
            Some("/docs"),
            &[]
        ));
        assert!(!matches_scope(
            &excluded,
            "example.com",
            false,
            Some("/docs"),
            &[]
        ));
        assert!(!matches_scope(
            &near_match,
            "example.com",
            false,
            Some("/docs"),
            &[]
        ));
    }

    #[test]
    fn scope_accepts_only_explicitly_allowlisted_hosts() {
        let external = url::Url::parse("https://docs.partner.example/guide").unwrap();
        let allowlist = vec!["docs.partner.example".to_string()];
        assert!(matches_scope(
            &external,
            "example.com",
            false,
            Some("/private"),
            &allowlist
        ));
        assert!(!matches_scope(
            &url::Url::parse("https://unknown.partner.example/guide").unwrap(),
            "example.com",
            false,
            None,
            &allowlist
        ));
    }

    #[test]
    fn allowlisted_hosts_are_normalized_and_invalid_entries_are_rejected() {
        let hosts = normalize_allowed_hosts(&[
            " HTTPS://Docs.Example.com/ ".to_string(),
            "docs.example.com".to_string(),
        ])
        .unwrap();
        assert_eq!(hosts, vec!["docs.example.com"]);
        assert!(normalize_allowed_hosts(&["docs.example.com/path".to_string()]).is_err());
    }

    #[test]
    fn filters_require_include_and_reject_exclude() {
        let include = vec![Regex::new("/docs/").unwrap()];
        let exclude = vec![Regex::new("private").unwrap()];
        assert!(matches_filters(
            "https://example.com/docs/guide",
            &include,
            &exclude
        ));
        assert!(!matches_filters(
            "https://example.com/blog/post",
            &include,
            &exclude
        ));
        assert!(!matches_filters(
            "https://example.com/docs/private",
            &include,
            &exclude
        ));
    }

    #[test]
    fn url_normalization_applies_explicit_path_and_query_rules_in_a_stable_order() {
        let mut config = crawl_config_for_test();
        config.keep_query_strings = true;
        config.trim_trailing_slash = true;
        config.lowercase_path = true;
        config.strip_tracking_parameters = true;
        config.allowed_query_parameters = vec!["page".into(), "lang".into(), "gclid".into()];
        config.denied_query_parameters = vec!["lang".into()];

        let source = url::Url::parse("https://example.com/Docs/Guide/?utm_source=newsletter&page=2&lang=pl&gclid=test#section").unwrap();
        let normalized = normalize_crawl_url(source, &config);

        assert_eq!(normalized.as_str(), "https://example.com/docs/guide?page=2");
    }

    #[test]
    fn url_normalization_keeps_the_existing_default_of_dropping_all_query_parameters() {
        let source = url::Url::parse("https://example.com/docs/?page=2#section").unwrap();
        let normalized = normalize_crawl_url(source, &crawl_config_for_test());

        assert_eq!(normalized.as_str(), "https://example.com/docs/");
    }

    #[test]
    fn url_normalization_collapses_default_ports_and_host_trailing_dots() {
        let https = url::Url::parse("HTTPS://Example.COM.:443/guide").unwrap();
        let http = url::Url::parse("http://Example.COM:80/guide").unwrap();

        assert_eq!(
            normalize_crawl_url(https, &crawl_config_for_test()).as_str(),
            "https://example.com/guide"
        );
        assert_eq!(
            normalize_crawl_url(http, &crawl_config_for_test()).as_str(),
            "http://example.com/guide"
        );
    }

    #[test]
    fn srcset_parser_preserves_candidate_commas_inside_data_urls_and_reads_descriptors() {
        let urls = parse_srcset_urls(
            "small.webp 1x, https://cdn.example.test/large.webp 2x, data:image/svg+xml,%3Csvg,%3E 3x",
        );

        assert_eq!(
            urls,
            vec![
                "small.webp",
                "https://cdn.example.test/large.webp",
                "data:image/svg+xml,%3Csvg,%3E",
            ]
        );
    }

    #[test]
    fn html_decoder_honors_http_charset_and_reports_invalid_byte_sequences() {
        let (decoded, charset, findings) =
            decode_crawl_html_body(b"<p>caf\xe9</p>", Some("windows-1252"));

        assert!(decoded.contains("café"));
        assert_eq!(charset.as_deref(), Some("windows-1252"));
        assert!(findings.is_empty());

        let (_, _, findings) = decode_crawl_html_body(b"<p>\xff</p>", Some("utf-8"));
        assert_eq!(findings[0].code, "encoding-invalid-byte-sequence");
        assert_eq!(findings[0].line, Some(1));
        assert!(findings[0]
            .source_excerpt
            .as_deref()
            .is_some_and(|excerpt| excerpt.contains('�')));
    }

    #[test]
    fn html_decoder_reports_unknown_charset_and_uses_utf8_fallback() {
        let (decoded, charset, findings) =
            decode_crawl_html_body(b"<p>ok</p>", Some("not-a-real-charset"));

        assert!(decoded.contains("ok"));
        assert_eq!(charset.as_deref(), Some("UTF-8"));
        assert_eq!(findings[0].code, "encoding-unsupported-label");
        assert!(findings[0].line.is_none());
    }

    #[test]
    fn html_decoder_uses_in_document_charset_when_http_does_not_declare_one() {
        let body = b"<meta charset=windows-1252><p>caf\xe9</p>";
        let (decoded, charset, findings) = decode_crawl_html_body(body, None);

        assert!(decoded.contains("café"));
        assert_eq!(charset.as_deref(), Some("windows-1252"));
        assert!(findings.is_empty());
    }

    #[test]
    fn html_decoder_locates_unsupported_in_document_charset() {
        let body = b"<html>\n<head><meta charset='not-a-real-charset'></head>\n</html>";
        let (_, charset, findings) = decode_crawl_html_body(body, None);

        assert_eq!(charset.as_deref(), Some("UTF-8"));
        assert_eq!(findings[0].code, "encoding-unsupported-label");
        assert_eq!(findings[0].line, Some(2));
        assert!(findings[0]
            .source_excerpt
            .as_deref()
            .is_some_and(|excerpt| excerpt.contains("charset='not-a-real-charset'")));
    }

    #[test]
    fn html_validation_reports_missing_doctype_duplicate_ids_and_malformed_uris() {
        let markup = r#"<html>
<body>
<div id="same"></div>
<span id="same"></span><a href="/bad%ZZ">Link</a>
</body></html>"#;
        let document = Html::parse_document(markup);
        let base = url::Url::parse("https://example.com/page").unwrap();

        let (findings, truncated) =
            validate_crawl_html_with_charset(&document, markup, &base, None);

        assert!(!truncated);
        assert!(findings
            .iter()
            .any(|finding| finding.code == "html-doctype-missing"));
        let doctype = findings
            .iter()
            .find(|finding| finding.code == "html-doctype-missing")
            .unwrap();
        assert_eq!(doctype.line, Some(1));
        assert_eq!(doctype.column, Some(1));
        assert!(doctype
            .source_excerpt
            .as_deref()
            .is_some_and(|excerpt| excerpt.contains("<html>")));
        let duplicate_id = findings
            .iter()
            .find(|finding| finding.code == "html-duplicate-id")
            .unwrap();
        assert_eq!(duplicate_id.line, Some(4));
        assert!(duplicate_id.column.is_some());
        assert!(duplicate_id
            .source_excerpt
            .as_deref()
            .is_some_and(|excerpt| excerpt.contains("id=\"same\"")));
        let malformed_uri = findings
            .iter()
            .find(|finding| finding.code == "html-uri-invalid")
            .unwrap();
        assert_eq!(malformed_uri.attribute.as_deref(), Some("href"));
        assert_eq!(malformed_uri.value.as_deref(), Some("/bad%ZZ"));
        assert_eq!(malformed_uri.line, Some(4));
        assert!(malformed_uri.column.is_some());
    }

    #[test]
    fn html_validation_reports_missing_language_and_charset_with_source_evidence() {
        let markup =
            "<!doctype html>\n<html>\n<head><title>Test</title></head>\n<body>ok</body>\n</html>";
        let document = Html::parse_document(markup);
        let base = url::Url::parse("https://example.com/page").unwrap();

        let (findings, truncated) =
            validate_crawl_html_with_charset(&document, markup, &base, None);

        assert!(!truncated);
        let language = findings
            .iter()
            .find(|finding| finding.code == "html-lang-missing")
            .expect("missing lang finding");
        assert_eq!(language.element.as_deref(), Some("html"));
        assert_eq!(language.attribute.as_deref(), Some("lang"));
        assert_eq!(language.line, Some(2));
        assert!(language
            .source_excerpt
            .as_deref()
            .is_some_and(|excerpt| excerpt.contains("<html>")));

        let charset = findings
            .iter()
            .find(|finding| finding.code == "html-meta-charset-missing")
            .expect("missing charset finding");
        assert_eq!(charset.element.as_deref(), Some("meta"));
        assert_eq!(charset.attribute.as_deref(), Some("charset"));
        assert_eq!(charset.line, Some(3));
        assert!(charset
            .source_excerpt
            .as_deref()
            .is_some_and(|excerpt| excerpt.contains("<head>")));
    }

    #[test]
    fn html_validation_accepts_meta_charset_variants_and_http_charset() {
        let base = url::Url::parse("https://example.com/page").unwrap();
        for markup in [
            "<!doctype html><html lang='pl'><head><meta charset='utf-8'></head><body></body></html>",
            "<!doctype html><html lang='pl'><head><meta http-equiv='Content-Type' content='text/html; charset=utf-8'></head><body></body></html>",
        ] {
            let document = Html::parse_document(markup);
            let (findings, _) = validate_crawl_html_with_charset(&document, markup, &base, None);
            assert!(!findings
                .iter()
                .any(|finding| finding.code == "html-meta-charset-missing"));
            assert!(!findings
                .iter()
                .any(|finding| finding.code == "html-lang-missing"));
        }

        let markup = "<!doctype html><html lang='pl'><head><title>HTTP charset</title></head><body></body></html>";
        let document = Html::parse_document(markup);
        let (findings, _) =
            validate_crawl_html_with_charset(&document, markup, &base, Some("utf-8"));
        assert!(!findings
            .iter()
            .any(|finding| finding.code == "html-meta-charset-missing"));
    }

    #[test]
    fn html_validation_distinguishes_invalid_and_duplicate_doctypes() {
        let base = url::Url::parse("https://example.com/page").unwrap();
        let invalid_markup =
            "<!doctype svg><html lang='en'><head><meta charset='utf-8'></head></html>";
        let invalid_document = Html::parse_document(invalid_markup);
        let (invalid_findings, _) =
            validate_crawl_html_with_charset(&invalid_document, invalid_markup, &base, None);
        assert!(invalid_findings
            .iter()
            .any(|finding| finding.code == "html-doctype-invalid"));
        assert!(!invalid_findings
            .iter()
            .any(|finding| finding.code == "html-doctype-missing"));

        let duplicate_markup = "<!doctype html>\n<!doctype html>\n<html lang='en'><head><meta charset='utf-8'></head></html>";
        let duplicate_document = Html::parse_document(duplicate_markup);
        let (duplicate_findings, _) =
            validate_crawl_html_with_charset(&duplicate_document, duplicate_markup, &base, None);
        let duplicate = duplicate_findings
            .iter()
            .find(|finding| finding.code == "html-doctype-duplicate")
            .expect("duplicate doctype finding");
        assert_eq!(duplicate.line, Some(2));
        assert!(duplicate
            .source_excerpt
            .as_deref()
            .is_some_and(|excerpt| excerpt.contains("<!doctype html>")));
        assert!(!duplicate_findings
            .iter()
            .any(|finding| finding.code == "html-doctype-invalid"));
    }

    #[test]
    fn resource_crawl_only_enables_explicitly_selected_resource_types() {
        let mut config = crawl_config_for_test();
        config.crawl_images = true;
        config.crawl_scripts = true;

        assert!(resource_type_enabled("image", &config));
        assert!(resource_type_enabled("script", &config));
        assert!(!resource_type_enabled("stylesheet", &config));
        assert!(!resource_type_enabled("other", &config));
        assert!(is_other_resource_url(
            &url::Url::parse("https://example.com/files/report.pdf").unwrap()
        ));
        assert!(!is_other_resource_url(
            &url::Url::parse("https://example.com/article").unwrap()
        ));
    }

    #[test]
    fn inline_image_dimensions_are_bounded_and_local_only() {
        let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];
        png.resize(24, 0);
        png[16..20].copy_from_slice(&2u32.to_be_bytes());
        png[20..24].copy_from_slice(&3u32.to_be_bytes());
        let png_uri = format!("data:image/png;base64,{}", BASE64_STANDARD.encode(png));
        assert_eq!(inline_image_dimensions(&png_uri), Some((2, 3)));
        assert_eq!(inline_image_format(&png_uri).as_deref(), Some("png"));

        let gif_uri = "data:image/gif;base64,R0lGODlhBAAFAAAA";
        assert_eq!(inline_image_dimensions(gif_uri), Some((4, 5)));
        let svg_uri = "data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20120%2060%22%3E%3C/svg%3E";
        assert_eq!(inline_image_dimensions(svg_uri), Some((120, 60)));
        let svg_attributes = "data:image/svg+xml,<svg width=\"80\" height=\"40\"></svg>";
        assert_eq!(inline_image_dimensions(svg_attributes), Some((80, 40)));
        let percentage_svg = "data:image/svg+xml,%3Csvg%20width%3D%22100%25%22%20height%3D%2250%25%22%20viewBox%3D%220%200%2080%2040%22%3E%3C/svg%3E";
        assert_eq!(inline_image_dimensions(percentage_svg), Some((80, 40)));
        assert!(inline_image_dimensions("https://example.com/image.png").is_none());
        let oversized = format!("data:image/png;base64,{}", "A".repeat(2_000_001));
        assert!(inline_image_dimensions(&oversized).is_none());
        assert!(
            bounded_inline_image_uri(&format!("data:image/png,{}", "x".repeat(9_000))).len()
                > MAX_INLINE_IMAGE_URI_CHARS
        );
    }

    #[test]
    fn fetched_image_dimensions_decode_bounded_supported_formats_without_retaining_body() {
        let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];
        png.resize(24, 0);
        png[16..20].copy_from_slice(&7u32.to_be_bytes());
        png[20..24].copy_from_slice(&9u32.to_be_bytes());
        assert_eq!(
            intrinsic_http_image_dimensions(Some("image/png"), &png),
            Some((7, 9))
        );

        let gif = b"GIF89a\x04\x00\x05\x00\x00\x00";
        assert_eq!(
            intrinsic_http_image_dimensions(Some("image/gif"), gif),
            Some((4, 5))
        );

        let mut webp = vec![0u8; 30];
        webp[0..4].copy_from_slice(b"RIFF");
        webp[8..12].copy_from_slice(b"WEBP");
        webp[12..16].copy_from_slice(b"VP8X");
        webp[24..27].copy_from_slice(&49u32.to_le_bytes()[..3]);
        webp[27..30].copy_from_slice(&39u32.to_le_bytes()[..3]);
        assert_eq!(
            intrinsic_http_image_dimensions(Some("image/webp"), &webp),
            Some((50, 40))
        );

        let jpeg = [
            0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x32, 0x00, 0x64, 0x00, 0x00, 0x00,
            0x00,
        ];
        assert_eq!(
            intrinsic_http_image_dimensions(Some("image/jpeg"), &jpeg),
            Some((100, 50))
        );

        let svg = br#"<svg viewBox="0 0 120 60"></svg>"#;
        assert_eq!(
            intrinsic_http_image_dimensions(Some("image/svg+xml"), svg),
            Some((120, 60))
        );

        let mut oversized = vec![0u8; MAX_INTRINSIC_IMAGE_BYTES + 1];
        oversized[..8].copy_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);
        assert!(intrinsic_http_image_dimensions(Some("image/png"), &oversized).is_none());
    }

    #[test]
    fn image_inventory_uses_only_matching_resource_responses_and_keeps_unknowns_unknown() {
        let config = crawl_config_for_test();
        let mut images = vec![
            CrawledImage {
                src: "https://example.com/photo.webp?version=2".into(),
                alt: Some("Photo".into()),
                srcset: None,
                format: Some("webp".into()),
                width: Some(640),
                height: Some(480),
                dimensions_source: Some("attributes".into()),
                lazy_loaded: false,
                checked_in_run: false,
                http_status: None,
                content_length: None,
                request_error_kind: None,
                srcset_resource_checks: vec![
                    CrawledImageResourceCheck {
                        url: "https://example.com/responsive.webp?width=2".into(),
                        checked_in_run: false,
                        http_status: None,
                        content_length: None,
                        request_error_kind: None,
                    },
                    CrawledImageResourceCheck {
                        url: "https://outside.example/responsive.webp".into(),
                        checked_in_run: false,
                        http_status: None,
                        content_length: None,
                        request_error_kind: None,
                    },
                ],
                srcset_resource_checks_truncated: false,
            },
            CrawledImage {
                src: "https://example.com/not-requested.webp".into(),
                alt: None,
                srcset: None,
                format: Some("webp".into()),
                width: None,
                height: None,
                dimensions_source: None,
                lazy_loaded: true,
                checked_in_run: false,
                http_status: None,
                content_length: None,
                request_error_kind: None,
                srcset_resource_checks: Vec::new(),
                srcset_resource_checks_truncated: false,
            },
        ];
        let resources = [
            CrawledResource {
                source_urls: vec!["https://example.com/page".into()],
                url: "https://example.com/photo.webp".into(),
                resource_type: "image".into(),
                http_status: Some(404),
                content_type: Some("image/webp".into()),
                content_length: Some(1234),
                intrinsic_width: None,
                intrinsic_height: None,
                dimensions_source: None,
                response_time_ms: Some(42),
                request_error_kind: None,
            },
            CrawledResource {
                source_urls: vec!["https://example.com/page".into()],
                url: "https://example.com/responsive.webp".into(),
                resource_type: "image".into(),
                http_status: Some(200),
                content_type: Some("image/webp".into()),
                content_length: Some(2048),
                intrinsic_width: None,
                intrinsic_height: None,
                dimensions_source: None,
                response_time_ms: Some(63),
                request_error_kind: None,
            },
        ];

        apply_checked_image_resources(&mut images, &resources, &config);

        assert!(images[0].checked_in_run);
        assert_eq!(images[0].http_status, Some(404));
        assert_eq!(images[0].content_length, Some(1234));
        assert!(images[0].srcset_resource_checks[0].checked_in_run);
        assert_eq!(images[0].srcset_resource_checks[0].http_status, Some(200));
        assert_eq!(
            images[0].srcset_resource_checks[0].content_length,
            Some(2048)
        );
        assert!(!images[0].srcset_resource_checks[1].checked_in_run);
        assert!(!images[1].checked_in_run);
        assert_eq!(images[1].http_status, None);
        assert_eq!(images[1].content_length, None);

        let fetched_dimensions = [CrawledResource {
            source_urls: vec!["https://example.com/page".into()],
            url: "https://example.com/not-requested.webp".into(),
            resource_type: "image".into(),
            http_status: Some(200),
            content_type: Some("image/webp".into()),
            content_length: Some(800),
            intrinsic_width: Some(320),
            intrinsic_height: Some(180),
            dimensions_source: Some("intrinsic-http".into()),
            response_time_ms: Some(11),
            request_error_kind: None,
        }];
        apply_checked_image_resources(&mut images, &fetched_dimensions, &config);
        assert_eq!(images[1].width, Some(320));
        assert_eq!(images[1].height, Some(180));
        assert_eq!(
            images[1].dimensions_source.as_deref(),
            Some("intrinsic-http")
        );
    }

    #[test]
    fn filter_validation_uses_the_crawler_regex_engine_and_explains_preview_decisions() {
        let result = validate_crawl_filters(
            vec!["/docs/".into()],
            vec!["private".into()],
            vec![
                "https://example.com/docs/guide".into(),
                "https://example.com/docs/private".into(),
                "https://example.com/blog/post".into(),
            ],
        );

        assert!(result.valid);
        assert_eq!(
            result
                .previews
                .iter()
                .map(|item| item.included)
                .collect::<Vec<_>>(),
            vec![true, false, false]
        );
        assert_eq!(result.previews[1].reason, "Matches an exclude pattern");
        assert_eq!(
            result.previews[2].reason,
            "Does not match any include pattern"
        );
    }

    #[test]
    fn filter_validation_reports_invalid_regex_without_starting_a_crawl() {
        let result = validate_crawl_filters(vec!["(".into()], Vec::new(), Vec::new());

        assert!(!result.valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].filter, "include");
        assert_eq!(result.errors[0].pattern, "(");
        assert!(result.previews.is_empty());
    }

    #[test]
    fn link_targets_are_normalized_before_matching_crawled_pages() {
        let mut target = url::Url::parse("https://example.com/article?source=ad#section").unwrap();
        target.set_fragment(None);
        target.set_query(None);
        assert_eq!(target.as_str(), "https://example.com/article");
    }

    #[test]
    fn crawl_deadline_is_enforced_from_the_start_of_the_run() {
        let expired = Instant::now() - std::time::Duration::from_secs(2);
        assert!(crawl_deadline_reached(expired, Some(1)));
        assert!(!crawl_deadline_reached(Instant::now(), Some(60)));
        assert!(!crawl_deadline_reached(expired, None));
    }

    #[test]
    fn robots_rules_prefer_the_longest_matching_rule() {
        let rules = parse_robots_rules(
            "User-agent: seomi\nDisallow: /private\nAllow: /private/public\n",
            "seomi",
        );
        assert!(!robots_allows(
            &url::Url::parse("https://example.com/private/one").unwrap(),
            &rules
        ));
        assert!(robots_allows(
            &url::Url::parse("https://example.com/private/public/page").unwrap(),
            &rules
        ));
    }

    #[test]
    fn robots_decision_combines_meta_and_header_tokens_with_sources() {
        let decision =
            build_robots_decision(Some("index, nofollow"), Some("googlebot: noindex"), true);

        assert_eq!(decision.indexability, "noindex");
        assert_eq!(decision.link_following, "nofollow");
        assert_eq!(decision.directives, vec!["index", "nofollow", "noindex"]);
        assert_eq!(decision.sources, vec!["meta robots", "X-Robots-Tag"]);
        assert!(decision.response_headers_available);
    }

    #[test]
    fn indexability_verdict_is_typed_and_explains_each_blocking_signal() {
        let blocked = build_indexability_verdict(200, "http", true, false, true, true, false);
        assert_eq!(blocked.status, "blocked");
        assert_eq!(
            blocked.reasons,
            vec![
                "robots_noindex",
                "canonical_points_elsewhere",
                "robots_nofollow"
            ]
        );

        let rendered =
            build_indexability_verdict(200, "browser-rendered", false, false, false, false, false);
        assert_eq!(rendered.status, "uncertain");
        assert_eq!(rendered.reasons, vec!["x_robots_header_unavailable"]);

        let redirect = build_indexability_verdict(301, "http", false, false, false, false, false);
        assert_eq!(redirect.status, "uncertain");
        assert_eq!(redirect.reasons, vec!["redirect_response"]);
    }

    #[test]
    fn transport_error_classifier_preserves_root_cause_fixtures() {
        let fixtures = [
            (
                false,
                true,
                "error sending request: dns error: failed to lookup address information",
                "dns",
            ),
            (
                false,
                true,
                "error trying to connect: invalid peer certificate: unknown CA",
                "tls",
            ),
            (
                false,
                true,
                "error trying to connect: tcp connection refused",
                "connect",
            ),
            (
                true,
                true,
                "error sending request: operation timed out",
                "timeout",
            ),
            (
                false,
                false,
                "error while reading response body: protocol failure",
                "network",
            ),
        ];

        for (is_timeout, is_connect, detail, expected) in fixtures {
            assert_eq!(
                classify_request_error(is_timeout, is_connect, detail),
                expected,
                "fixture should classify as {expected}: {detail}"
            );
        }
    }

    #[test]
    fn robots_rules_allow_equal_length_ties() {
        let rules = parse_robots_rules(
            "User-agent: seomi\nDisallow: /private\nAllow: /private\n",
            "seomi",
        );
        let url = url::Url::parse("https://example.com/private").unwrap();

        assert!(robots_allows(&url, &rules));
        assert!(robots_deciding_rule(&url, &rules).unwrap().allow);
    }

    #[test]
    fn robots_rules_match_escaped_and_human_readable_paths() {
        let rules = parse_robots_rules(
            "User-agent: seomi\nDisallow: /private%20area/$\nDisallow: /search?q=summer%20sale\n",
            "seomi",
        );
        let escaped_path = url::Url::parse("https://example.com/private%20area/").unwrap();
        let readable_path = url::Url::parse("https://example.com/private area/").unwrap();
        let escaped_query = url::Url::parse("https://example.com/search?q=summer%20sale").unwrap();

        assert!(!robots_allows(&escaped_path, &rules));
        assert!(!robots_allows(&readable_path, &rules));
        assert!(!robots_allows(&escaped_query, &rules));
    }

    #[test]
    fn robots_path_matching_keeps_invalid_percent_escapes_literal() {
        let rules = parse_robots_rules("User-agent: *\nDisallow: /bad%ZZ\n", "seomi");
        let matching = url::Url::parse("https://example.com/bad%ZZ").unwrap();
        let different = url::Url::parse("https://example.com/bad-value").unwrap();

        assert!(!robots_allows(&matching, &rules));
        assert!(robots_allows(&different, &rules));
    }

    #[test]
    fn robots_specific_agent_group_overrides_the_wildcard_group() {
        let rules = parse_robots_rules(
            "User-agent: *\nDisallow: /\nUser-agent: SEOmiDesktopBot\nAllow: /public\n",
            "SEOmiDesktopBot/1.0",
        );

        assert_eq!(rules.len(), 1);
        assert!(robots_allows(
            &url::Url::parse("https://example.com/private").unwrap(),
            &rules
        ));
        assert!(robots_allows(
            &url::Url::parse("https://example.com/public").unwrap(),
            &rules
        ));
    }

    #[test]
    fn robots_agent_matrix_keeps_specific_groups_and_wildcard_fallbacks_separate() {
        let matrix = build_robots_agent_matrix(
            "User-agent: *\nDisallow: /\nUser-agent: GPTBot\nAllow: /ai\nCrawl-delay: 2\n",
            "SEOmiDesktopBot/1.0",
        );
        let desktop = matrix
            .iter()
            .find(|entry| entry.user_agent == "SEOmiDesktopBot/1.0")
            .expect("effective user-agent is included");
        assert!(!desktop.specific_group);
        assert_eq!(desktop.applicable_rules[0].directive, "disallow");

        let gpt = matrix
            .iter()
            .find(|entry| entry.user_agent == "GPTBot")
            .expect("GPTBot is included");
        assert!(gpt.specific_group);
        assert_eq!(gpt.applicable_rules[0].directive, "allow");
        assert_eq!(gpt.crawl_delay_ms, Some(2_000));
    }

    #[test]
    fn robots_rules_support_wildcards_and_end_anchors() {
        let rules = parse_robots_rules(
            "User-agent: *\nDisallow: /private/*/secret$\n",
            "SEOmiDesktopBot/1.0",
        );

        assert!(!robots_allows(
            &url::Url::parse("https://example.com/private/a/secret").unwrap(),
            &rules
        ));
        assert!(robots_allows(
            &url::Url::parse("https://example.com/private/a/secret/more").unwrap(),
            &rules
        ));
    }

    #[test]
    fn robots_parser_ignores_empty_disallow_and_preserves_sitemap_directives() {
        let content =
            "User-agent: *\nDisallow:\nAllow: /public\nSitemap: https://example.com/sitemap.xml\n";
        let rules = parse_robots_rules(content, "SEOmiDesktopBot/1.0");

        assert_eq!(rules.len(), 1);
        assert!(robots_allows(
            &url::Url::parse("https://example.com/private").unwrap(),
            &rules
        ));
        assert_eq!(
            parse_sitemap_directives(content),
            vec!["https://example.com/sitemap.xml"]
        );
    }

    #[test]
    fn robots_crawl_delay_is_parsed_for_the_active_agent_and_capped() {
        let delay =
            parse_robots_crawl_delay("User-agent: seomi\nCrawl-delay: 1.5\n", "seomi").unwrap();
        let capped_delay =
            parse_robots_crawl_delay("User-agent: *\nCrawl-delay: 999\n", "seomi").unwrap();

        assert_eq!(delay, std::time::Duration::from_millis(1_500));
        assert_eq!(capped_delay, std::time::Duration::from_secs(60));
    }

    #[test]
    fn extracts_locations_from_urlset_and_sitemap_index() {
        let locations = parse_sitemap_locations("<urlset><url><loc>https://example.com/a</loc></url><sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap></urlset>");
        assert_eq!(
            locations,
            vec!["https://example.com/a", "https://example.com/sitemap-2.xml"]
        );
    }

    #[test]
    fn normalizes_whitespace_and_case_when_fingerprinting_content() {
        let first = Html::parse_document("<html><body>Hello   WORLD</body></html>");
        let second = Html::parse_document("<html><body>hello world</body></html>");
        assert_eq!(
            normalized_content_fingerprint(&first),
            normalized_content_fingerprint(&second)
        );
    }

    #[test]
    fn simhash_near_duplicate_pairs_use_a_visible_hamming_threshold() {
        let pairs = near_duplicate_pairs(&[
            (0, "0000000000000000".into()),
            (1, "0000000000000003".into()),
            (2, "ffffffffffffffff".into()),
        ]);

        assert_eq!(pairs, vec![(0, 1, 2)]);
        assert_eq!(
            simhash_distance("0000000000000000", "0000000000000003"),
            Some(2)
        );
    }

    #[test]
    fn simhash_is_stable_for_normalized_document_text() {
        let first = Html::parse_document("<html><body>One TWO three four five six</body></html>");
        let second =
            Html::parse_document("<html><body>one two   three four five six</body></html>");

        assert_eq!(content_simhash(&first), content_simhash(&second));
    }

    #[test]
    fn discovers_json_ld_types_in_top_level_and_graph() {
        let value: serde_json::Value = serde_json::from_str(
            r#"{"@type":"WebSite","@graph":[{"@type":["Organization","Thing"]}]}"#,
        )
        .unwrap();
        let mut types = Vec::new();
        collect_json_ld_types(&value, &mut types);
        assert_eq!(types, vec!["WebSite", "Organization", "Thing"]);
    }

    #[test]
    fn crawl_schema_inventory_includes_static_validation_findings_for_all_formats() {
        let document = Html::parse_document(
            r#"<html><head>
              <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":" ","offers":null}</script>
              <script type="application/ld+json">{invalid json}</script>
            </head><body>
              <div itemscope itemtype="Product"><span itemprop="name">Example</span></div>
              <div vocab="relative-vocab" typeof="Article" property="headline">Example</div>
            </body></html>"#,
        );

        let (types, syntax_errors, findings, references, truncated) =
            inspect_page_schema(&document);
        assert!(types.contains(&"Product".to_string()));
        assert!(types.contains(&"Article".to_string()));
        assert!(references.is_empty());
        assert_eq!(syntax_errors, 1);
        assert!(!truncated);
        assert!(findings
            .iter()
            .any(|item| item.finding.code == "product-name-empty-or-invalid"));
        assert!(findings
            .iter()
            .any(|item| item.finding.code == "product-related-property-shape-invalid"));
        assert!(findings
            .iter()
            .any(|item| item.finding.code == "jsonld-syntax-invalid"));
        assert!(findings
            .iter()
            .any(|item| item.finding.code == "microdata-itemtype-not-absolute"));
        assert!(findings
            .iter()
            .any(|item| item.finding.code == "rdfa-vocab-not-absolute"));
        let serialized = serde_json::to_value(&findings[0]).expect("finding should serialize");
        assert!(serialized.get("finding").is_some());
    }

    #[test]
    fn schema_inventory_retains_only_bounded_declared_identifiers_and_relations() {
        let document = Html::parse_document(
            r#"<html><head>
              <script type="application/ld+json">
                {"@context":"https://schema.org","@type":"Organization","@id":"https://example.com/#org","url":"https://example.com/","sameAs":["https://social.example/acme",{"@id":"https://example.com/about"}],"publisher":{"@id":"https://example.com/#org"}}
              </script>
            </head><body>
              <div itemscope itemtype="https://schema.org/Article" itemid="https://example.com/article#item" itemref="author-node"></div>
              <div vocab="https://schema.org" typeof="Article"><a property="author" resource="https://example.com/author">Author</a></div>
            </body></html>"#,
        );

        let (_, _, _, references, truncated) = inspect_page_schema(&document);
        assert!(!truncated);
        assert!(references.iter().any(|reference| {
            reference.format == "JSON-LD"
                && reference.property == "@id"
                && reference.value == "https://example.com/#org"
        }));
        assert!(references.iter().any(|reference| {
            reference.format == "Microdata"
                && reference.property == "itemref"
                && reference.value == "author-node"
        }));
        assert!(references.iter().any(|reference| {
            reference.format == "RDFa"
                && reference.property == "author"
                && reference.value == "https://example.com/author"
        }));
        assert_eq!(
            references
                .iter()
                .filter(|reference| reference.property == "publisher")
                .count(),
            0,
            "nested objects without explicit @id/url must not become invented references"
        );
    }

    #[test]
    fn crawl_social_metadata_collects_open_graph_and_twitter_tags_only() {
        let document = Html::parse_document(
            r#"<html><head>
              <meta property="og:title" content="Actual title">
              <meta property="og:description" content="Actual description">
              <meta name="twitter:card" content="summary_large_image">
              <meta name="description" content="Not a social-card tag">
            </head></html>"#,
        );
        let base = url::Url::parse("https://example.com/page").unwrap();

        let (_, tags) = crawl_social_metadata(&document, &base);

        assert_eq!(tags.len(), 3);
        assert_eq!(tags[0].key, "og:title");
        assert_eq!(tags[0].content.as_deref(), Some("Actual title"));
        assert_eq!(tags[2].key, "twitter:card");
    }

    #[test]
    fn crawl_favicon_metadata_preserves_declaration_attributes_and_deduplicates() {
        let document = Html::parse_document(
            r#"<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
              <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
              <link rel="shortcut icon" href="/favicon.ico">
              <link rel="stylesheet" href="/app.css">"#,
        );
        let base = url::Url::parse("https://example.com/articles/page").unwrap();

        let favicons = crawl_favicon_metadata(&document, &base);

        assert_eq!(favicons.len(), 2);
        assert_eq!(favicons[0].href, "https://example.com/favicon.svg");
        assert_eq!(favicons[0].rel, "icon");
        assert_eq!(favicons[0].declared_type.as_deref(), Some("image/svg+xml"));
        assert_eq!(favicons[0].declared_sizes.as_deref(), Some("any"));
        assert_eq!(favicons[0].inferred_format.as_deref(), Some("svg"));
        assert_eq!(favicons[1].rel, "shortcut icon");
        assert_eq!(favicons[1].inferred_format.as_deref(), Some("ico"));
    }

    #[test]
    fn crawl_frames_resolves_http_targets_and_preserves_frame_attributes() {
        let document = Html::parse_document(
            r#"<iframe src="../embed?id=1" title="Video" name="player" loading="lazy" sandbox="allow-scripts"></iframe>
              <iframe srcdoc="<p>inline</p>"></iframe>
              <iframe src="javascript:alert(1)"></iframe>
              <iframe></iframe>"#,
        );
        let base = url::Url::parse("https://example.com/articles/page").unwrap();

        let (frames, truncated) = crawl_frames(&document, &base);

        assert!(!truncated);
        assert_eq!(frames.len(), 4);
        assert_eq!(frames[0].src.as_deref(), Some("../embed?id=1"));
        assert_eq!(
            frames[0].resolved_url.as_deref(),
            Some("https://example.com/embed?id=1")
        );
        assert_eq!(frames[0].title.as_deref(), Some("Video"));
        assert_eq!(frames[0].name.as_deref(), Some("player"));
        assert_eq!(frames[0].loading.as_deref(), Some("lazy"));
        assert_eq!(frames[0].sandbox.as_deref(), Some("allow-scripts"));
        assert!(frames[1..].iter().all(|frame| frame.resolved_url.is_none()));
    }

    #[test]
    fn crawl_social_metadata_normalizes_keys_but_preserves_duplicate_declarations() {
        let document = Html::parse_document(
            r#"<meta property="OG:TITLE" content="First"><meta property="og:title" content="Second">"#,
        );
        let base = url::Url::parse("https://example.com/").unwrap();

        let (_, tags) = crawl_social_metadata(&document, &base);

        assert_eq!(tags.len(), 2);
        assert!(tags.iter().all(|tag| tag.key == "og:title"));
        assert_eq!(tags[0].content.as_deref(), Some("First"));
        assert_eq!(tags[1].content.as_deref(), Some("Second"));
    }

    #[test]
    fn crawl_social_metadata_resolves_declared_social_urls_against_final_url() {
        let document = Html::parse_document(
            r#"<meta property="og:url" content="../canonical"><meta property="og:image" content="/social.png"><meta name="twitter:image" content="images/card.jpg">"#,
        );
        let base = url::Url::parse("https://example.com/folder/page").unwrap();

        let (_, tags) = crawl_social_metadata(&document, &base);

        assert_eq!(
            tags[0].content.as_deref(),
            Some("https://example.com/canonical")
        );
        assert_eq!(
            tags[1].content.as_deref(),
            Some("https://example.com/social.png")
        );
        assert_eq!(
            tags[2].content.as_deref(),
            Some("https://example.com/folder/images/card.jpg")
        );
    }

    #[test]
    fn crawl_social_metadata_distinguishes_missing_content_from_empty_content() {
        let document = Html::parse_document(
            r#"<meta property="og:title"><meta property="og:description" content="">"#,
        );
        let base = url::Url::parse("https://example.com/").unwrap();

        let (_, tags) = crawl_social_metadata(&document, &base);

        assert_eq!(tags[0].content, None);
        assert_eq!(tags[1].content.as_deref(), Some(""));
    }

    #[test]
    fn crawl_social_metadata_discovers_and_deduplicates_http_favicons() {
        let document = Html::parse_document(
            r#"<link rel="shortcut icon" href="/favicon.ico"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="icons/touch.png"><link rel="icon" href="javascript:alert(1)"><link rel="alternate" href="feed.xml">"#,
        );
        let base = url::Url::parse("https://example.com/articles/page").unwrap();

        let (favicons, _) = crawl_social_metadata(&document, &base);

        assert_eq!(
            favicons,
            vec![
                "https://example.com/favicon.ico",
                "https://example.com/articles/icons/touch.png"
            ]
        );
    }

    #[test]
    fn crawl_social_metadata_creates_unchecked_records_for_declared_image_resources() {
        let document = Html::parse_document(
            r#"<meta property="og:image" content="../share.webp"><meta property="og:image:width" content="1200"><meta name="twitter:image:src" content="https://cdn.example.test/card.png"><meta property="og:title" content="A title">"#,
        );
        let base = url::Url::parse("https://example.com/articles/page").unwrap();

        let (_, tags) = crawl_social_metadata(&document, &base);

        let og_image = tags.iter().find(|tag| tag.key == "og:image").unwrap();
        assert_eq!(
            og_image.content.as_deref(),
            Some("https://example.com/share.webp")
        );
        let check = og_image.resource_check.as_ref().unwrap();
        assert_eq!(check.url, "https://example.com/share.webp");
        assert!(!check.checked_in_run);
        assert_eq!(check.http_status, None);
        let twitter_image = tags
            .iter()
            .find(|tag| tag.key == "twitter:image:src")
            .unwrap();
        assert!(twitter_image.resource_check.is_some());
        let width = tags.iter().find(|tag| tag.key == "og:image:width").unwrap();
        assert!(width.resource_check.is_none());
        let title = tags.iter().find(|tag| tag.key == "og:title").unwrap();
        assert!(title.resource_check.is_none());
    }

    #[test]
    fn optional_social_image_requests_respect_image_enablement_and_crawl_scope() {
        let base = url::Url::parse("https://example.com/articles/page").unwrap();
        let mut config = crawl_config_for_test();
        let mut candidates = HashMap::new();
        add_resource_candidate(
            &mut candidates,
            "https://example.com/articles/page",
            &base,
            "https://example.com/articles/share.png",
            "image",
            "example.com",
            &config,
        );
        assert!(candidates.is_empty());

        config.crawl_images = true;
        add_resource_candidate(
            &mut candidates,
            "https://example.com/articles/page",
            &base,
            "https://example.com/articles/share.png",
            "image",
            "example.com",
            &config,
        );
        add_resource_candidate(
            &mut candidates,
            "https://example.com/articles/page",
            &base,
            "https://cdn.example.net/share.png",
            "image",
            "example.com",
            &config,
        );
        assert_eq!(candidates.len(), 1);
        assert_eq!(
            candidates.values().next().unwrap().url,
            "https://example.com/articles/share.png"
        );
    }

    #[test]
    fn checked_social_resources_keep_http_status_content_type_and_size() {
        let config = crawl_config_for_test();
        let mut checks = vec![
            unchecked_social_resource("https://example.com/favicon.ico"),
            unchecked_social_resource("https://example.com/social.png"),
            unchecked_social_resource("https://example.com/not-checked.png"),
        ];
        let resources = [
            CrawledResource {
                source_urls: vec!["https://example.com/page".into()],
                url: "https://example.com/favicon.ico".into(),
                resource_type: "image".into(),
                http_status: Some(200),
                content_type: Some("image/x-icon".into()),
                content_length: Some(321),
                intrinsic_width: None,
                intrinsic_height: None,
                dimensions_source: None,
                response_time_ms: Some(12),
                request_error_kind: None,
            },
            CrawledResource {
                source_urls: vec!["https://example.com/page".into()],
                url: "https://example.com/social.png".into(),
                resource_type: "image".into(),
                http_status: Some(404),
                content_type: Some("text/html".into()),
                content_length: Some(82),
                intrinsic_width: None,
                intrinsic_height: None,
                dimensions_source: None,
                response_time_ms: Some(34),
                request_error_kind: None,
            },
        ];
        let checked_images = resources
            .iter()
            .map(|resource| (resource.url.as_str(), resource))
            .collect::<HashMap<_, _>>();

        apply_checked_social_resource_checks(&mut checks, &checked_images, &config);

        assert!(checks[0].checked_in_run);
        assert_eq!(checks[0].http_status, Some(200));
        assert_eq!(checks[0].content_type.as_deref(), Some("image/x-icon"));
        assert_eq!(checks[0].content_length, Some(321));
        assert_eq!(checks[1].http_status, Some(404));
        assert_eq!(checks[1].content_length, Some(82));
        assert!(!checks[2].checked_in_run);
        assert_eq!(checks[2].http_status, None);
    }

    #[test]
    fn crawl_social_metadata_keeps_http_links_but_does_not_resolve_non_http_social_values() {
        let document = Html::parse_document(
            r#"<meta property="og:image" content="javascript:alert(1)"><link rel="icon" href="data:image/png;base64,AA==">"#,
        );
        let base = url::Url::parse("https://example.com/").unwrap();

        let (favicons, tags) = crawl_social_metadata(&document, &base);

        assert!(favicons.is_empty());
        assert_eq!(tags[0].content.as_deref(), Some("javascript:alert(1)"));
    }
}
