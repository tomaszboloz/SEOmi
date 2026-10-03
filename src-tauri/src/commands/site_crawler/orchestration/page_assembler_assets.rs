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

pub fn extract_page_assets(
    document: &Html,
    final_base: &Url,
    final_url: &str,
    depth: usize,
    has_primary_content_root: bool,
    is_html: bool,
    extra: &PageExtraOutcome,
    selectors: &CrawlSelectors,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
    issues: &mut Vec<CrawledPageIssue>,
) -> AssembledPageAssets {
    let links = if is_html {
        extract_page_links(
            document,
            final_base,
            final_url,
            depth,
            has_primary_content_root,
            &selectors.a,
            setup,
            state,
        )
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
            document,
            final_base,
            final_url,
            &extra.frames,
            &selectors.script_src,
            &selectors.link_href,
            &selectors.media_src,
            setup,
            state,
        );
    }

    AssembledPageAssets { links, images }
}
