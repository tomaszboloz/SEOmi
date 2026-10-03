use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageAuditData {
    pub url: String,
    pub final_url: String,
    pub timestamp: DateTime<Utc>,
    pub http_status: u16,
    pub response_time_ms: u64,
    pub redirect_chain: Vec<RedirectHop>,
    pub meta_tags: MetaTags,
    pub open_graph: OpenGraphData,
    pub twitter_card: TwitterCardData,
    pub headings: HeadingsStructure,
    pub images: Vec<ImageData>,
    pub links: LinksAnalysis,
    pub security_headers: SecurityHeaders,
    pub structured_data: Vec<StructuredData>,
    pub technical: TechnicalData,
    pub health_score: u8,
    pub issues: Vec<Issue>,
    pub content_stats: ContentStats,
    #[serde(default)]
    pub indexability: IndexabilityAssessment,
    #[serde(default)]
    pub accessibility: AccessibilityAudit,
    #[serde(default)]
    pub amp: AmpAudit,
    #[serde(default)]
    pub http_performance: Option<HttpPerformanceMeasurement>,
    #[serde(default)]
    pub transport_security: Option<TransportSecurityAudit>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HttpPerformanceMeasurement {
    pub measured_at: DateTime<Utc>,
    pub method: String,
    pub response_headers_ms: u64,
    pub body_read_ms: u64,
    pub total_request_ms: u64,
    pub decoded_body_bytes: u64,
    pub content_length_header_bytes: Option<u64>,
    pub redirect_hops: usize,
    pub scope: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RedirectHop {
    pub url: String,
    pub status_code: u16,
    pub location: Option<String>,
}
