use super::crawl_result::default_http_crawl_mode;
use crate::services::custom_search::CustomSearchDefinition;
use serde::{Deserialize, Serialize};

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
    #[serde(default)]
    pub resume_completed_urls: Vec<String>,
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

pub fn default_respect_robots() -> bool {
    true
}

pub fn default_verify_ssl() -> bool {
    true
}

pub fn default_respect_crawl_delay() -> bool {
    true
}

pub fn default_discover_sitemaps() -> bool {
    true
}
