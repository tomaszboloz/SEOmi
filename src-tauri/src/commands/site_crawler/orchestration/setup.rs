use regex::Regex;
use std::collections::HashSet;
use std::time::Instant;

use super::super::{
    control::CrawlControl, filter_validation::compile_filter_patterns, models::CrawlConfig,
    scope::normalize_allowed_hosts, url_normalization::normalize_crawl_url,
};
use super::setup_client::build_crawler_client;
use super::setup_config::{default_crawl_config, resolve_resume_urls};
use crate::services::custom_search::validate_custom_searches;
use crate::utils::url_validator::validate_and_normalize_url;

pub struct CrawlSetup {
    pub start_time: Instant,
    pub parsed_base: url::Url,
    pub base_host: String,
    pub config: CrawlConfig,
    pub normalized_start_url: url::Url,
    pub resume_completed_urls: HashSet<String>,
    pub resume_frontier_urls: Vec<String>,
    pub limit: usize,
    pub max_depth: usize,
    pub max_redirects: usize,
    pub max_response_bytes: usize,
    pub max_run_seconds: Option<u64>,
    pub include_patterns: Vec<Regex>,
    pub exclude_patterns: Vec<Regex>,
    pub run_id: String,
    pub rendered_cookie: Option<String>,
    pub ua: String,
    pub client: reqwest::Client,
}

impl CrawlSetup {
    pub fn init(
        start_url: String,
        max_pages: Option<usize>,
        user_agent: Option<String>,
        run_id: Option<String>,
        project_id: Option<String>,
        config: Option<CrawlConfig>,
        control: &CrawlControl,
    ) -> Result<Self, String> {
        let start_time = Instant::now();
        let parsed_base = validate_and_normalize_url(&start_url).map_err(|e| e.to_string())?;
        let base_host = match parsed_base.host_str() {
            Some(h) => h.to_string(),
            None => return Err("URL has no valid hostname".into()),
        };
        let mut config = config.unwrap_or_else(|| default_crawl_config(max_pages));
        config.allowed_hosts = normalize_allowed_hosts(&config.allowed_hosts)?;
        config.focus_phrase = config
            .focus_phrase
            .take()
            .map(|phrase| phrase.trim().chars().take(160).collect::<String>())
            .filter(|phrase| !phrase.is_empty());
        if !matches!(config.crawl_mode.as_str(), "http" | "browser-rendered") {
            return Err("Crawl mode must be either http or browser-rendered.".into());
        }
        let normalized_start_url = normalize_crawl_url(parsed_base.clone(), &config);
        let (resume_completed_urls, resume_frontier_urls) =
            resolve_resume_urls(&config, &base_host);
        validate_custom_searches(&config.custom_searches)?;
        let limit = config
            .max_pages
            .or(max_pages)
            .unwrap_or(25)
            .clamp(1, 10_000);
        let max_depth = config.max_depth.unwrap_or(usize::MAX).min(100);
        let max_redirects = config.max_redirects.unwrap_or(10).min(50);
        let max_response_bytes = config
            .max_response_bytes
            .unwrap_or(5_000_000)
            .clamp(1_024, 50_000_000);
        let max_run_seconds = config
            .max_run_seconds
            .map(|seconds| seconds.clamp(1, 3_600));
        let include_patterns = compile_filter_patterns(&config.include_patterns, "include")
            .map_err(|e| format!("Invalid include filter `{}`: {}", e.pattern, e.message))?;
        let exclude_patterns = compile_filter_patterns(&config.exclude_patterns, "exclude")
            .map_err(|e| format!("Invalid exclude filter `{}`: {}", e.pattern, e.message))?;
        let run_id = run_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        let (client, ua, rendered_cookie) =
            build_crawler_client(project_id.as_deref(), &config, user_agent)?;
        control.start(&run_id);

        Ok(Self {
            start_time,
            parsed_base,
            base_host,
            config,
            normalized_start_url,
            resume_completed_urls,
            resume_frontier_urls,
            limit,
            max_depth,
            max_redirects,
            max_response_bytes,
            max_run_seconds,
            include_patterns,
            exclude_patterns,
            run_id,
            rendered_cookie,
            ua,
            client,
        })
    }
}
