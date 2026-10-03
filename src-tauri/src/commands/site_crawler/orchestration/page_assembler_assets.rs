#[path = "page_assembler_assets_inputs.rs"]
mod inputs;
pub use inputs::ExtractPageAssetsInput;

use scraper::Html;
use url::Url;

use super::super::models::{CrawledImage, CrawledPageIssue};
use super::page_extra::PageExtraOutcome;
use super::page_links::{extract_page_links, PageLinksOutcome};
use super::page_media::extract_page_images;
use super::page_resources_discovery::register_page_resource_candidates;
use super::selectors::CrawlSelectors;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub struct AssembledPageAssets {
    pub links: PageLinksOutcome,
    pub images: Vec<CrawledImage>,
}

pub fn extract_page_assets(input: ExtractPageAssetsInput<'_>) -> AssembledPageAssets {
    let ExtractPageAssetsInput {
        document,
        final_base,
        final_url,
        depth,
        has_primary_content_root,
        is_html,
        extra,
        selectors,
        setup,
        state,
        issues,
    } = input;
    let links = if is_html {
        extract_page_links(super::page_links::ExtractPageLinksInput {
            document,
            final_base,
            final_url,
            depth,
            has_primary_content_root,
            a_selector: &selectors.a,
            setup,
            state,
        })
    } else {
        PageLinksOutcome {
            links: Vec::new(),
            semantic_links: Vec::new(),
            internal_link_count: 0,
            external_link_count: 0,
        }
    };

    let images = if is_html {
        extract_page_images(
            document,
            final_base,
            final_url,
            &selectors.image,
            setup,
            state,
            issues,
        )
    } else {
        Vec::new()
    };

    if is_html {
        register_page_resource_candidates(
            super::page_resources_discovery::RegisterPageResourceCandidatesInput {
                document,
                final_base,
                final_url,
                frames: &extra.frames,
                script_src_selector: &selectors.script_src,
                link_href_selector: &selectors.link_href,
                media_src_selector: &selectors.media_src,
                setup,
                state,
            },
        );
    }

    AssembledPageAssets { links, images }
}
