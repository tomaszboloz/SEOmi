use crate::models::audit_data::{HttpPerformanceMeasurement, RedirectHop};
use std::collections::HashMap;
use std::time::Duration;

pub const MAX_BODY_BYTES: usize = 25 * 1024 * 1024; // 25 MB max to prevent memory exhaustion
pub const DNS_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Clone)]
pub struct FetchResult {
    pub url: String,
    pub final_url: String,
    pub status: u16,
    pub response_time_ms: u64,
    pub headers: HashMap<String, String>,
    pub set_cookie_headers: Vec<String>,
    pub redirect_chain: Vec<RedirectHop>,
    pub body: String,
    pub http_performance: HttpPerformanceMeasurement,
}

#[derive(Debug, Clone)]
pub struct FetchOptions {
    pub timeout: Duration,
    pub max_redirects: usize,
    pub verify_ssl: bool,
    pub max_body_bytes: usize,
}
