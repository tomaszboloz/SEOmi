use std::collections::{HashMap, HashSet, VecDeque};
use std::time::Instant;

use super::super::{
    fetch_types::{CrawlFetchFailure, FetchedResponse},
    models::{CrawledDiscoverySource, CrawledPageSummary, RejectedCrawlUrl, ResourceCandidate},
};
use crate::commands::rendered_crawler::RenderedCrawlerSession;
use crate::services::custom_search::MAX_CUSTOM_SEARCH_CHARS_PER_RUN;

pub struct CrawlLoopState {
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
    pub rendered_session: Option<RenderedCrawlerSession>,
    pub rendered_init_error: Option<String>,
    pub prefetched_order: VecDeque<(String, usize)>,
    pub prefetched_responses: HashMap<String, Result<FetchedResponse, CrawlFetchFailure>>,
}

impl CrawlLoopState {
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
            rendered_session: None,
            rendered_init_error: None,
            prefetched_order: VecDeque::new(),
            prefetched_responses: HashMap::new(),
        }
    }
}
