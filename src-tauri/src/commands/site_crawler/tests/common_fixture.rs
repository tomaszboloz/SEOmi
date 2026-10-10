use super::*;
pub(super) fn post_processing_page(url: &str) -> CrawledPageSummary {
    serde_json::from_value(serde_json::json!({
        "url": url, "final_url": url, "redirect_chain": [], "depth": 0,
        "http_status": 200, "response_time_ms": 0, "indexability_status": "indexable",
        "body_truncated": false, "word_count": 0, "schema_types": [], "schema_syntax_errors": 0,
        "hreflangs": [], "h1_count": 0, "heading_counts": [0, 0, 0, 0, 0, 0],
        "internal_link_count": 0, "external_link_count": 0,
        "links": [], "images": [], "issues_count": 0, "issues": []
    }))
    .unwrap()
}
pub(super) fn crawl_config_for_test() -> CrawlConfig {
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
