use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SecurityHeaders {
    pub strict_transport_security: Option<String>,
    pub content_security_policy: Option<String>,
    #[serde(default)]
    pub content_security_policy_report_only: Option<String>,
    pub x_frame_options: Option<String>,
    pub x_content_type_options: Option<String>,
    pub referrer_policy: Option<String>,
    pub permissions_policy: Option<String>,
    pub cross_origin_opener_policy: Option<String>,
    pub cross_origin_resource_policy: Option<String>,
    pub server: Option<String>,
    pub x_powered_by: Option<String>,
    /// All observed response values, retained so repeated policy headers are not lost.
    #[serde(default)]
    pub repeated_headers: HashMap<String, Vec<String>>,
    pub score: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct TransportSecurityAudit {
    pub scheme: String,
    pub https: bool,
    pub mixed_content_urls: Vec<String>,
    pub cookies: Vec<CookieSecurityFinding>,
    pub tls_coverage: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CookieSecurityFinding {
    pub name: String,
    pub secure: bool,
    pub http_only: bool,
    pub same_site: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuredData {
    pub data_type: String,
    pub format: String,
    pub content: serde_json::Value,
    #[serde(default)]
    pub validation_issues: Vec<StructuredDataValidationIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StructuredDataValidationIssue {
    pub code: String,
    pub severity: String,
    pub message: String,
    pub path: Option<String>,
    pub recommendation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TechnicalData {
    pub content_type: Option<String>,
    pub server: Option<String>,
    pub favicon: Option<String>,
    #[serde(default)]
    pub favicons: Vec<FaviconData>,
    pub robots_txt_url: Option<String>,
    pub sitemap_url: Option<String>,
    pub hreflang_tags: Vec<HreflangTag>,
    #[serde(default)]
    pub technology_signals: Vec<TechnologySignal>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FaviconData {
    pub href: String,
    pub rel: String,
    pub declared_type: Option<String>,
    pub declared_sizes: Option<String>,
    pub inferred_format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TechnologySignal {
    pub name: String,
    pub category: String,
    pub evidence: String,
    pub confidence: String,
    #[serde(default)]
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HreflangTag {
    pub hreflang: String,
    pub href: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct AmpAudit {
    pub detected: bool,
    pub is_amp_document: bool,
    pub amphtml_urls: Vec<String>,
    pub canonical_url: Option<String>,
    pub coverage: String,
    pub findings: Vec<AmpFinding>,
    pub unchecked: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AmpFinding {
    pub code: String,
    pub severity: String,
    pub message: String,
    pub evidence: String,
    pub recommendation: String,
}
