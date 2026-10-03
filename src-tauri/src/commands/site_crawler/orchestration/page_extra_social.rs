use scraper::Html;
use url::Url;

use super::super::{
    favicon::crawl_favicon_metadata,
    frames::crawl_frames,
    models::{CrawledFrame, CrawledSocialMetaTag, CrawledSocialResourceCheck},
    resource_discovery::add_resource_candidate,
    social::{crawl_social_metadata, unchecked_social_resource},
};
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;
use crate::models::audit_data::FaviconData;

pub struct PageExtraSocialOutcome {
    pub favicons: Vec<String>,
    pub favicon_metadata: Vec<FaviconData>,
    pub favicon_resource_checks: Vec<CrawledSocialResourceCheck>,
    pub social_meta_tags: Vec<CrawledSocialMetaTag>,
    pub frames: Vec<CrawledFrame>,
    pub frames_truncated: bool,
}

pub fn extract_page_social_and_frames(
    document: &Html,
    final_base: &Url,
    final_url: &str,
    is_html: bool,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
) -> PageExtraSocialOutcome {
    let (favicons, social_meta_tags, favicon_metadata) = if is_html {
        let (urls, social) = crawl_social_metadata(document, final_base);
        (urls, social, crawl_favicon_metadata(document, final_base))
    } else {
        (Vec::new(), Vec::new(), Vec::new())
    };
    let (frames, frames_truncated) = if is_html {
        crawl_frames(document, final_base)
    } else {
        (Vec::new(), false)
    };
    let favicon_resource_checks = favicons
        .iter()
        .map(|f| unchecked_social_resource(f))
        .collect::<Vec<_>>();
    for favicon in &favicon_resource_checks {
        add_resource_candidate(
            &mut state.resource_candidates,
            final_url,
            final_base,
            &favicon.url,
            "image",
            &setup.base_host,
            &setup.config,
        );
    }
    for social_image in social_meta_tags
        .iter()
        .filter_map(|t| t.resource_check.as_ref())
    {
        add_resource_candidate(
            &mut state.resource_candidates,
            final_url,
            final_base,
            &social_image.url,
            "image",
            &setup.base_host,
            &setup.config,
        );
    }

    PageExtraSocialOutcome {
        favicons,
        favicon_metadata,
        favicon_resource_checks,
        social_meta_tags,
        frames,
        frames_truncated,
    }
}
