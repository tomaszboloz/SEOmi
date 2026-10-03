use scraper::{Html, Selector};
use url::Url;

use super::super::{
    constants::MAX_SRCSET_CANDIDATES_PER_IMAGE,
    models::{CrawledImage, CrawledPageIssue},
    resource_discovery::add_resource_candidate,
};
use super::page_media_build::build_crawled_image;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub fn extract_page_images(
    document: &Html,
    final_base: &Url,
    final_url: &str,
    image_selector: &Selector,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
    issues: &mut Vec<CrawledPageIssue>,
) -> Vec<CrawledImage> {
    let mut images = Vec::new();
    let mut missing_alt_count = 0usize;

    for element in document.select(image_selector) {
        let Some(src) = element.value().attr("src") else {
            continue;
        };
        let src = src.trim();
        let inline_image = src.to_ascii_lowercase().starts_with("data:image/");
        let resolved = final_base
            .join(src)
            .ok()
            .filter(|u| u.scheme() == "http" || u.scheme() == "https");
        if resolved.is_none() && !inline_image {
            continue;
        }

        let built = build_crawled_image(&element, src, resolved.as_ref(), inline_image, final_base);
        if built.image.alt.is_none() {
            missing_alt_count += 1;
        }
        if images.len() < 5_000 {
            images.push(built.image);
        }
        if resolved.is_some() {
            add_resource_candidate(
                &mut state.resource_candidates,
                final_url,
                final_base,
                src,
                "image",
                &setup.base_host,
                &setup.config,
            );
        }
        for candidate in built
            .parsed_srcset_urls
            .iter()
            .take(MAX_SRCSET_CANDIDATES_PER_IMAGE)
        {
            add_resource_candidate(
                &mut state.resource_candidates,
                final_url,
                final_base,
                candidate,
                "image",
                &setup.base_host,
                &setup.config,
            );
        }
    }

    if missing_alt_count > 0 {
        issues.push(CrawledPageIssue {
            severity: "Warning".into(),
            message: format!("{missing_alt_count} image(s) missing alt text"),
        });
    }

    images
}
