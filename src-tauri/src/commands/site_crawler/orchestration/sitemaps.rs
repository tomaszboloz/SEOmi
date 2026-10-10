use super::super::{
    models::{record_discovery_source, CrawledDiscoverySource},
    retry::{read_bounded_text_with_retry, send_get_with_retry},
    scope::matches_scope,
    sitemap::parse_sitemap_locations,
    transport::crawl_deadline_reached,
    url_normalization::normalize_crawl_url,
};
use super::setup::CrawlSetup;
use crate::utils::url_validator::validate_and_normalize_url;
use std::collections::{HashMap, HashSet, VecDeque};

pub struct CrawlSitemapsOutcome {
    pub sitemap_status: String,
    pub sitemap_urls: Vec<String>,
    pub discovery_sources_by_url: HashMap<String, Vec<CrawledDiscoverySource>>,
    pub discovery_provenance_truncated: bool,
    pub timed_out: bool,
}
pub async fn discover_and_parse_sitemaps(
    setup: &CrawlSetup,
    robots_sitemaps: &[String],
) -> Result<CrawlSitemapsOutcome, String> {
    let mut timed_out = false;
    let mut sitemap_urls = Vec::new();
    let mut unique_urls = HashSet::new();
    let mut discovery_sources_by_url: HashMap<String, Vec<CrawledDiscoverySource>> = HashMap::new();
    let mut discovery_provenance_truncated = false;
    let sitemap_status = if setup.config.discover_sitemaps {
        let candidates = if robots_sitemaps.is_empty() {
            vec![setup
                .parsed_base
                .join("/sitemap.xml")
                .map_err(|error| format!("Failed to construct sitemap URL: {error}"))?
                .to_string()]
        } else {
            robots_sitemaps.to_vec()
        };
        let mut sources_loaded = 0usize;
        let mut sources_failed = 0usize;
        let mut sitemap_queue: VecDeque<String> = candidates.into_iter().collect();
        let mut visited_sitemaps = HashSet::new();
        while let Some(candidate) = sitemap_queue.pop_front() {
            if crawl_deadline_reached(setup.start_time, setup.max_run_seconds) {
                timed_out = true;
                break;
            }
            if visited_sitemaps.len() >= 20 || !visited_sitemaps.insert(candidate.clone()) {
                continue;
            }
            let Ok(sitemap_url) = validate_and_normalize_url(&candidate) else {
                continue;
            };
            if !matches_scope(
                &sitemap_url,
                &setup.base_host,
                setup.config.allow_subdomains,
                None,
                &setup.config.allowed_hosts,
            ) {
                continue;
            }
            let mut retry_available = true;
            let retry_context = setup.retry_context();
            let response = send_get_with_retry(
                &setup.client,
                sitemap_url.as_str(),
                &retry_context,
                &mut retry_available,
            )
            .await
            .map(|result| result.response);
            if let Ok(response) = response {
                if response.status().is_success() {
                    let content = match read_bounded_text_with_retry(
                        response,
                        setup.max_response_bytes,
                        &retry_context,
                    )
                    .await
                    {
                        Ok(content) => content,
                        Err(_) => {
                            sources_failed += 1;
                            continue;
                        }
                    };
                    sources_loaded += 1;
                    let locations = parse_sitemap_locations(&content);
                    let is_index = content.to_ascii_lowercase().contains("<sitemapindex");
                    for location in locations {
                        if let Ok(url) = validate_and_normalize_url(&location) {
                            if matches_scope(
                                &url,
                                &setup.base_host,
                                setup.config.allow_subdomains,
                                if is_index {
                                    None
                                } else {
                                    setup.config.scope_path.as_deref()
                                },
                                &setup.config.allowed_hosts,
                            ) {
                                if is_index {
                                    sitemap_queue.push_back(url.to_string());
                                } else {
                                    let normalized = normalize_crawl_url(url, &setup.config);
                                    let normalized_url = normalized.to_string();
                                    if unique_urls.contains(&normalized_url)
                                        || sitemap_urls.len() < 10_000
                                    {
                                        if unique_urls.insert(normalized_url.clone()) {
                                            sitemap_urls.push(normalized_url.clone());
                                        }
                                        discovery_provenance_truncated |= !record_discovery_source(
                                            &mut discovery_sources_by_url,
                                            &normalized_url,
                                            CrawledDiscoverySource {
                                                kind: "sitemap".into(),
                                                source_url: Some(sitemap_url.to_string()),
                                                anchor_text: None,
                                            },
                                        );
                                    } else {
                                        discovery_provenance_truncated = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        sitemap_urls.sort();
        sitemap_urls.dedup();
        format!(
            "Loaded {sources_loaded} sitemap source(s), found {} in-scope URL(s); {sources_failed} source body read(s) failed or exceeded the safety limit",
            sitemap_urls.len()
        )
    } else {
        "Sitemap discovery disabled by this crawl configuration".into()
    };
    Ok(CrawlSitemapsOutcome {
        sitemap_status,
        sitemap_urls,
        discovery_sources_by_url,
        discovery_provenance_truncated,
        timed_out,
    })
}
