#[path = "page_links_inputs.rs"]
mod inputs;
pub use inputs::ExtractPageLinksInput;

use scraper::{Html, Selector};
use url::Url;

use super::super::{
    constants::MAX_SEMANTIC_CONTENT_LINKS_PER_PAGE,
    models::CrawledLink,
    resource_discovery::{add_resource_candidate, is_other_resource_url},
    scope::matches_scope,
    semantic_chrome::semantic_content_contains,
    semantics::bounded_link_source_excerpt,
    url_normalization::normalize_crawl_url,
};
use super::page_links_enqueue::{enqueue_frontier_link, record_internal_link_provenance};
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub struct PageLinksOutcome {
    pub links: Vec<CrawledLink>,
    pub semantic_links: Vec<CrawledLink>,
    pub internal_link_count: usize,
    pub external_link_count: usize,
}

pub fn extract_page_links(input: ExtractPageLinksInput<'_>) -> PageLinksOutcome {
    let ExtractPageLinksInput {
        document,
        final_base,
        final_url,
        depth,
        has_primary_content_root,
        a_selector,
        setup,
        state,
    } = input;
    let mut internal_link_count = 0usize;
    let mut external_link_count = 0usize;
    let mut links = Vec::new();
    let mut semantic_links = Vec::new();

    for element in document.select(a_selector) {
        let Some(href) = element.value().attr("href") else {
            continue;
        };
        if href.starts_with('#') || href.starts_with("javascript:") || href.starts_with("mailto:") {
            continue;
        }

        if let Ok(resolved) = final_base.join(href) {
            if resolved.scheme() != "http" && resolved.scheme() != "https" {
                continue;
            }
            let is_internal = matches_scope(
                &resolved,
                &setup.base_host,
                setup.config.allow_subdomains,
                setup.config.scope_path.as_deref(),
                &setup.config.allowed_hosts,
            );
            let anchor_text = element
                .text()
                .collect::<Vec<_>>()
                .join(" ")
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            let is_semantic = semantic_content_contains(&element, has_primary_content_root);
            let rel = element.value().attr("rel").map(str::to_owned);
            let source_excerpt = bounded_link_source_excerpt(&element);
            let is_nofollow = rel.as_deref().is_some_and(|v| {
                v.split_ascii_whitespace()
                    .any(|t| t.eq_ignore_ascii_case("nofollow"))
            });
            let target_for_run = normalize_crawl_url(resolved.clone(), &setup.config);

            if is_internal {
                record_internal_link_provenance(
                    target_for_run.as_str(),
                    final_url,
                    &anchor_text,
                    state,
                );
            }
            if links.len() < 5_000 {
                links.push(CrawledLink {
                    target_url: target_for_run.to_string(),
                    anchor_text: anchor_text.clone(),
                    rel: rel.clone(),
                    is_internal,
                    source_excerpt: source_excerpt.clone(),
                    target_http_status: None,
                    target_response_time_ms: None,
                    target_redirect_url: None,
                    target_request_error_kind: None,
                    target_checked_at: None,
                });
            }
            if is_internal
                && is_semantic
                && semantic_links.len() < MAX_SEMANTIC_CONTENT_LINKS_PER_PAGE
            {
                semantic_links.push(CrawledLink {
                    target_url: target_for_run.to_string(),
                    anchor_text,
                    rel,
                    is_internal: true,
                    source_excerpt,
                    target_http_status: None,
                    target_response_time_ms: None,
                    target_redirect_url: None,
                    target_request_error_kind: None,
                    target_checked_at: None,
                });
            }
            if is_other_resource_url(&resolved) {
                add_resource_candidate(
                    &mut state.resource_candidates,
                    final_url,
                    final_base,
                    href,
                    "other",
                    &setup.base_host,
                    &setup.config,
                );
            }
            if is_internal {
                internal_link_count += 1;
                enqueue_frontier_link(target_for_run.to_string(), depth, is_nofollow, setup, state);
            } else {
                external_link_count += 1;
            }
        }
    }

    PageLinksOutcome {
        links,
        semantic_links,
        internal_link_count,
        external_link_count,
    }
}
