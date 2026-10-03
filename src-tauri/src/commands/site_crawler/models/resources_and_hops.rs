use serde::{Deserialize, Serialize};

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
pub struct ResourceCandidate {
    pub source_urls: Vec<String>,
    pub url: String,
    pub resource_type: String,
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
