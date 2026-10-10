use std::collections::{HashMap, HashSet, VecDeque};
use std::time::Instant;
use tauri::Runtime;

use super::super::{
    fetch_types::{CrawlFetchFailure, FetchedResponse},
    models::{CrawledDiscoverySource, CrawledPageSummary, RejectedCrawlUrl, ResourceCandidate},
    render_health::RenderHealth,
};
use crate::commands::rendered_crawler::RenderedCrawlerSession;
use crate::services::custom_search::MAX_CUSTOM_SEARCH_CHARS_PER_RUN;

pub struct CrawlLoopState<R: Runtime = tauri::Wry> {
    pub visited: HashSet<String>,
    pub queue: VecDeque<(String, usize)>,
    pub pages: Vec<CrawledPageSummary>,
    pub rejected_urls: Vec<RejectedCrawlUrl>,
    pub discovery_sources_by_url: HashMap<String, Vec<CrawledDiscoverySource>>,
    pub discovery_provenance_truncated: bool,
    pub resource_candidates: HashMap<String, ResourceCandidate>,
    pub custom_search_remaining_chars: usize,
    pub robots_blocked_count: usize,
    pub depth_limit_reached: bool,
    pub timed_out: bool,
    pub last_page_request_at: Option<Instant>,
    /// Idle renderer windows. Each one is an isolated browser context that
    /// renders a single page at a time; several render a window of queued
    /// pages concurrently.
    pub rendered_sessions: Vec<RenderedCrawlerSession<R>>,
    pub render_health: RenderHealth,
    pub prefetched_order: VecDeque<(String, usize)>,
    pub prefetched_responses: HashMap<String, Result<FetchedResponse, CrawlFetchFailure>>,
}

impl<R: Runtime> CrawlLoopState<R> {
    pub fn new(
        visited: HashSet<String>,
        queue: VecDeque<(String, usize)>,
        rejected_urls: Vec<RejectedCrawlUrl>,
        discovery_sources_by_url: HashMap<String, Vec<CrawledDiscoverySource>>,
        discovery_provenance_truncated: bool,
        timed_out: bool,
    ) -> Self {
        Self {
            visited,
            queue,
            pages: Vec::new(),
            rejected_urls,
            discovery_sources_by_url,
            discovery_provenance_truncated,
            resource_candidates: HashMap::new(),
            custom_search_remaining_chars: MAX_CUSTOM_SEARCH_CHARS_PER_RUN,
            robots_blocked_count: 0,
            depth_limit_reached: false,
            timed_out,
            last_page_request_at: None,
            rendered_sessions: Vec::new(),
            render_health: RenderHealth::default(),
            prefetched_order: VecDeque::new(),
            prefetched_responses: HashMap::new(),
        }
    }
}
