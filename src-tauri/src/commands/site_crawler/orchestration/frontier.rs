use std::collections::{HashMap, HashSet, VecDeque};

use super::super::{
    models::{record_discovery_source, CrawledDiscoverySource, RejectedCrawlUrl},
    scope::{matches_filters, matches_scope},
    url_normalization::normalize_crawl_url,
};
use super::setup::CrawlSetup;
use crate::utils::url_validator::validate_and_normalize_url;

pub struct CrawlFrontierOutcome {
    pub visited: HashSet<String>,
    pub queue: VecDeque<(String, usize)>,
    pub rejected_urls: Vec<RejectedCrawlUrl>,
}

pub fn init_frontier(
    setup: &CrawlSetup,
    sitemap_urls: &[String],
    discovery_sources_by_url: &mut HashMap<String, Vec<CrawledDiscoverySource>>,
    discovery_provenance_truncated: &mut bool,
) -> CrawlFrontierOutcome {
    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<(String, usize)> = VecDeque::new();
    let mut rejected_urls: Vec<RejectedCrawlUrl> = Vec::new();

    let mut seed_candidates = if setup.config.list_mode {
        setup
            .config
            .seed_urls
            .iter()
            .cloned()
            .map(|url| (url, "seed"))
            .collect::<Vec<_>>()
    } else {
        vec![(setup.normalized_start_url.to_string(), "start")]
    };
    if !setup.config.list_mode {
        seed_candidates.extend(sitemap_urls.iter().cloned().map(|url| (url, "sitemap")));
    }
    seed_candidates.extend(
        setup
            .resume_frontier_urls
            .iter()
            .cloned()
            .map(|url| (url, "resume")),
    );

    for (candidate, discovery_kind) in seed_candidates {
        let url = match validate_and_normalize_url(&candidate) {
            Ok(url) => url,
            Err(error) => {
                rejected_urls.push(RejectedCrawlUrl {
                    url: candidate,
                    reason: format!("Rejected by URL safety validation: {error}"),
                });
                continue;
            }
        };
        if !matches_scope(
            &url,
            &setup.base_host,
            setup.config.allow_subdomains,
            setup.config.scope_path.as_deref(),
            &setup.config.allowed_hosts,
        ) {
            rejected_urls.push(RejectedCrawlUrl {
                url: candidate,
                reason: "Outside configured crawl scope".into(),
            });
            continue;
        }
        let normalized = normalize_crawl_url(url, &setup.config).to_string();
        if !matches_filters(
            &normalized,
            &setup.include_patterns,
            &setup.exclude_patterns,
        ) {
            rejected_urls.push(RejectedCrawlUrl {
                url: normalized,
                reason: "Excluded by crawl filter".into(),
            });
            continue;
        }
        if setup.resume_completed_urls.contains(&normalized) {
            visited.insert(normalized);
            continue;
        }
        let is_start_url =
            !setup.config.list_mode && normalized == setup.normalized_start_url.to_string();
        if is_start_url {
            *discovery_provenance_truncated |= !record_discovery_source(
                discovery_sources_by_url,
                &normalized,
                CrawledDiscoverySource {
                    kind: "start".into(),
                    source_url: None,
                    anchor_text: None,
                },
            );
        } else if discovery_kind == "seed" {
            *discovery_provenance_truncated |= !record_discovery_source(
                discovery_sources_by_url,
                &normalized,
                CrawledDiscoverySource {
                    kind: "seed".into(),
                    source_url: None,
                    anchor_text: None,
                },
            );
        } else if !discovery_sources_by_url.contains_key(&normalized) {
            *discovery_provenance_truncated |= !record_discovery_source(
                discovery_sources_by_url,
                &normalized,
                CrawledDiscoverySource {
                    kind: discovery_kind.into(),
                    source_url: None,
                    anchor_text: None,
                },
            );
        }
        if visited.insert(normalized.clone()) {
            queue.push_back((normalized, 0));
        }
    }

    CrawlFrontierOutcome {
        visited,
        queue,
        rejected_urls,
    }
}
