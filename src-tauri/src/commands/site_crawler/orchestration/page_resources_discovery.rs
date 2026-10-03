use scraper::{Html, Selector};
use url::Url;

use super::super::{models::CrawledFrame, resource_discovery::add_resource_candidate};
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

#[allow(clippy::too_many_arguments)]
pub fn register_page_resource_candidates(
    document: &Html,
    final_base: &Url,
    final_url: &str,
    frames: &[CrawledFrame],
    script_src_selector: &Selector,
    link_href_selector: &Selector,
    media_src_selector: &Selector,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
) {
    for element in document.select(script_src_selector) {
        let Some(src) = element.value().attr("src") else {
            continue;
        };
        add_resource_candidate(
            &mut state.resource_candidates,
            final_url,
            final_base,
            src,
            "script",
            &setup.base_host,
            &setup.config,
        );
    }
    for element in document.select(link_href_selector) {
        let Some(href) = element.value().attr("href") else {
            continue;
        };
        let rel = element.value().attr("rel").unwrap_or_default();
        let kind = if rel.eq_ignore_ascii_case("stylesheet") {
            "stylesheet"
        } else {
            "other"
        };
        add_resource_candidate(
            &mut state.resource_candidates,
            final_url,
            final_base,
            href,
            kind,
            &setup.base_host,
            &setup.config,
        );
    }
    for element in document.select(media_src_selector) {
        let Some(src) = element.value().attr("src") else {
            continue;
        };
        add_resource_candidate(
            &mut state.resource_candidates,
            final_url,
            final_base,
            src,
            "other",
            &setup.base_host,
            &setup.config,
        );
    }
    for frame in frames {
        if let Some(frame_url) = &frame.resolved_url {
            add_resource_candidate(
                &mut state.resource_candidates,
                final_url,
                final_base,
                frame_url,
                "other",
                &setup.base_host,
                &setup.config,
            );
        }
    }
}
