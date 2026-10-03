use crate::models::audit_data::StructuredDataValidationIssue;
use serde::{Deserialize, Serialize};

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
