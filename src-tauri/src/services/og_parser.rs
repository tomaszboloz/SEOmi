use crate::models::audit_data::{OpenGraphData, TwitterCardData};

#[path = "og_collector.rs"]
mod og_collector;

use og_collector::collect_social_meta;

pub struct SocialTagsResult {
    pub open_graph: OpenGraphData,
    pub twitter_card: TwitterCardData,
}

/// Extracts Open Graph and Twitter Card tags with fallback logic
pub fn parse_social_tags(
    html_str: &str,
    base_url: &str,
    page_title: Option<&str>,
    page_description: Option<&str>,
) -> SocialTagsResult {
    let raw = collect_social_meta(html_str, base_url);

    let final_og_title = raw.og_title.or_else(|| page_title.map(|s| s.to_string()));
    let final_og_desc = raw
        .og_description
        .or_else(|| page_description.map(|s| s.to_string()));

    let final_tw_title = raw.twitter_title.or_else(|| final_og_title.clone());
    let final_tw_desc = raw.twitter_description.or_else(|| final_og_desc.clone());
    let final_tw_image = raw.twitter_image.or_else(|| raw.og_image.clone());

    SocialTagsResult {
        open_graph: OpenGraphData {
            og_title: final_og_title,
            og_description: final_og_desc,
            og_image: raw.og_image,
            og_image_width: raw.og_image_width,
            og_image_height: raw.og_image_height,
            og_url: raw.og_url,
            og_type: raw.og_type,
            og_site_name: raw.og_site_name,
            og_locale: raw.og_locale,
            all_tags: raw.og_tags,
        },
        twitter_card: TwitterCardData {
            twitter_card: raw.twitter_card,
            twitter_site: raw.twitter_site,
            twitter_creator: raw.twitter_creator,
            twitter_title: final_tw_title,
            twitter_description: final_tw_desc,
            twitter_image: final_tw_image,
            all_tags: raw.twitter_tags,
        },
    }
}

#[cfg(test)]
#[path = "og_parser_tests.rs"]
mod tests;
