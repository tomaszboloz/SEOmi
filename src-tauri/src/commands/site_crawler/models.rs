use super::*;

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
pub(super) struct ResourceCandidate {
    pub(super) source_urls: Vec<String>,
    pub(super) url: String,
    pub(super) resource_type: String,
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

pub(super) fn default_http_crawl_mode() -> String {
    "http".into()
}

pub(super) fn default_semantic_content_source() -> String {
    "unavailable".into()
}

pub(super) fn default_semantic_content_provenance() -> String {
    "unavailable".into()
}

pub(super) fn semantic_provenance_for_mode(crawl_mode: &str, content_source: &str) -> String {
    if content_source == "unavailable" {
        "unavailable".into()
    } else if crawl_mode == "browser-rendered" {
        "rendered".into()
    } else {
        "http".into()
    }
}

pub(super) fn semantic_content_is_partial(
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

pub(super) const MAX_DISCOVERY_SOURCES_PER_PAGE: usize = 16;
pub(super) const MAX_DISCOVERY_TARGETS_PER_RUN: usize = 20_000;

pub(super) fn record_discovery_source(
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

pub(super) fn robots_directive_tokens(value: Option<&str>) -> Vec<String> {
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

pub(super) fn build_robots_decision(
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

pub(super) fn build_indexability_verdict(
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

pub(super) fn default_respect_robots() -> bool {
    true
}

pub(super) fn default_verify_ssl() -> bool {
    true
}
pub(super) fn default_respect_crawl_delay() -> bool {
    true
}
pub(super) fn default_discover_sitemaps() -> bool {
    true
}
