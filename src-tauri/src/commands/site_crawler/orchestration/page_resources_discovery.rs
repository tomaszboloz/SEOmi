#[path = "page_resources_discovery_inputs.rs"]
mod inputs;
pub use inputs::RegisterPageResourceCandidatesInput;

use scraper::{Html, Selector};
use tauri::Runtime;
use url::Url;

use super::super::{models::CrawledFrame, resource_discovery::add_resource_candidate};
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub fn register_page_resource_candidates<R: Runtime>(
    input: RegisterPageResourceCandidatesInput<'_, R>,
) {
    let RegisterPageResourceCandidatesInput {
        document,
        final_base,
        final_url,
        frames,
        script_src_selector,
        link_href_selector,
        media_src_selector,
        setup,
        state,
    } = input;
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
