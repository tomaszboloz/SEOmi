use std::collections::HashSet;
use url::Url;

use super::super::{
    models::{default_http_crawl_mode, CrawlConfig},
    scope::matches_scope,
    url_normalization::normalize_crawl_url,
};
use crate::utils::url_validator::validate_and_normalize_url;

pub fn default_crawl_config(max_pages: Option<usize>) -> CrawlConfig {
    CrawlConfig {
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
    }
}

pub fn resolve_resume_urls(
    config: &CrawlConfig,
    base_host: &str,
) -> (HashSet<String>, Vec<String>) {
    let resume_completed_urls: HashSet<String> = config
        .resume_completed_urls
        .iter()
        .filter_map(|candidate| validate_and_normalize_url(candidate).ok())
        .map(|url| normalize_crawl_url(url, config).to_string())
        .filter(|url| {
            Url::parse(url).ok().is_some_and(|parsed| {
                matches_scope(
                    &parsed,
                    base_host,
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
        .map(|url| normalize_crawl_url(url, config).to_string())
        .filter(|url| !resume_completed_urls.contains(url))
        .take(20_000)
        .collect();

    (resume_completed_urls, resume_frontier_urls)
}
