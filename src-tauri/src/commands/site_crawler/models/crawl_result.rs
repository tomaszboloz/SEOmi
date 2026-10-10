use super::page_summary::CrawledPageSummary;
use super::resources_and_hops::{CrawledRedirectHop, CrawledResource};
use super::robots_and_indexability::{CrawledRobotsAgent, CrawledRobotsRule};
use crate::commands::site_crawler::{
    MAX_SEMANTIC_CONTENT_LINKS_PER_PAGE, MAX_SEMANTIC_EXCERPTS_PER_PAGE,
    MAX_SEMANTIC_TERMS_PER_PAGE,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SiteCrawlResult {
    pub start_url: String,
    #[serde(default = "default_http_crawl_mode")]
    pub crawl_mode: String,
    pub pages_crawled: usize,
    pub health_score: u8,
    /// Zero identifies legacy snapshots whose formula was not recorded.
    #[serde(default)]
    pub score_version: u16,
    pub critical_count: usize,
    pub warning_count: usize,
    pub notice_count: usize,
    pub pages: Vec<CrawledPageSummary>,
    pub duration_ms: u64,
    pub cancelled: bool,
    pub timed_out: bool,
    pub robots_txt_status: String,
    #[serde(default)]
    pub robots_txt_evaluation_status: String,
    #[serde(default)]
    pub robots_txt_warning: Option<String>,
    #[serde(default)]
    pub robots_txt_status_code: Option<u16>,
    #[serde(default)]
    pub robots_txt_final_url: Option<String>,
    #[serde(default)]
    pub robots_txt_redirect_chain: Vec<CrawledRedirectHop>,
    #[serde(default)]
    pub robots_user_agent: String,
    #[serde(default)]
    pub robots_applicable_rules: Vec<CrawledRobotsRule>,
    #[serde(default)]
    pub robots_agent_matrix: Vec<CrawledRobotsAgent>,
    #[serde(default)]
    pub robots_sitemap_directives: Vec<String>,
    pub robots_blocked_count: usize,
    pub sitemap_status: String,
    pub sitemap_urls_discovered: usize,
    pub sitemap_urls: Vec<String>,
    pub rejected_urls: Vec<RejectedCrawlUrl>,
    pub resources: Vec<CrawledResource>,
    pub resource_limit_reached: bool,
    #[serde(default)]
    pub discovery_provenance_truncated: bool,
    #[serde(default)]
    pub limit_reasons: Vec<String>,
}

pub fn default_http_crawl_mode() -> String {
    "http".into()
}

pub fn default_semantic_content_source() -> String {
    "unavailable".into()
}

pub fn default_semantic_content_provenance() -> String {
    "unavailable".into()
}

pub fn semantic_provenance_for_mode(crawl_mode: &str, content_source: &str) -> String {
    if content_source == "unavailable" {
        "unavailable".into()
    } else if crawl_mode == "browser-rendered" {
        "rendered".into()
    } else {
        "http".into()
    }
}

pub fn semantic_content_is_partial(
    body_truncated: bool,
    body_read_failed: bool,
    term_count: usize,
    excerpt_count: usize,
    link_count: usize,
) -> bool {
    body_truncated
        || body_read_failed
        || term_count >= MAX_SEMANTIC_TERMS_PER_PAGE
        || excerpt_count >= MAX_SEMANTIC_EXCERPTS_PER_PAGE
        || link_count >= MAX_SEMANTIC_CONTENT_LINKS_PER_PAGE
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RejectedCrawlUrl {
    pub url: String,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CrawledDiscoverySource {
    pub kind: String,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub anchor_text: Option<String>,
}

pub const MAX_DISCOVERY_SOURCES_PER_PAGE: usize = 16;
pub const MAX_DISCOVERY_TARGETS_PER_RUN: usize = 20_000;

pub fn record_discovery_source(
    sources_by_url: &mut HashMap<String, Vec<CrawledDiscoverySource>>,
    target_url: &str,
    source: CrawledDiscoverySource,
) -> bool {
    if !sources_by_url.contains_key(target_url)
        && sources_by_url.len() >= MAX_DISCOVERY_TARGETS_PER_RUN
    {
        return false;
    }
    let sources = sources_by_url.entry(target_url.to_owned()).or_default();
    if sources.iter().any(|candidate| candidate == &source) {
        return true;
    }
    if sources.len() < MAX_DISCOVERY_SOURCES_PER_PAGE {
        sources.push(source);
        true
    } else {
        false
    }
}
