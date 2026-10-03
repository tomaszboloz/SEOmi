use serde::Serialize;
use std::time::Duration;

pub const MAX_EXTERNAL_LINKS_PER_RUN: usize = 1_000;
pub const DEFAULT_EXTERNAL_LINK_LIMIT: usize = 250;
pub const MAX_CONCURRENT_EXTERNAL_LINKS: usize = 4;
pub const DNS_TIMEOUT: Duration = Duration::from_secs(5);
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalLinkCheck {
    pub url: String,
    pub http_status: Option<u16>,
    pub response_time_ms: Option<u64>,
    pub redirect_url: Option<String>,
    pub request_error_kind: Option<String>,
    pub checked_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalLinkCheckBatch {
    pub requested: usize,
    pub checked: usize,
    pub omitted: usize,
    pub results: Vec<ExternalLinkCheck>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalLinkCheckProgress {
    pub request_id: String,
    pub completed: usize,
    pub total: usize,
    pub current_url: String,
    pub http_status: Option<u16>,
    pub request_error_kind: Option<String>,
}
