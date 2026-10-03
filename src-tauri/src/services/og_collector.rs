use crate::models::audit_data::MetaTag;
use scraper::{Html, Selector};
use url::Url;

pub(crate) fn resolve_url(href: &str, base: Option<&Url>) -> String {
    if let Some(base_url) = base {
        if let Ok(joined) = base_url.join(href) {
            return joined.to_string();
        }
    }
    href.to_string()
}

pub(crate) struct RawSocialMeta {
    pub og_tags: Vec<MetaTag>,
    pub twitter_tags: Vec<MetaTag>,
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_image: Option<String>,
    pub og_image_width: Option<String>,
    pub og_image_height: Option<String>,
    pub og_url: Option<String>,
    pub og_type: Option<String>,
    pub og_site_name: Option<String>,
    pub og_locale: Option<String>,
    pub twitter_card: Option<String>,
    pub twitter_site: Option<String>,
    pub twitter_creator: Option<String>,
    pub twitter_title: Option<String>,
    pub twitter_description: Option<String>,
    pub twitter_image: Option<String>,
}

pub(crate) fn collect_social_meta(html_str: &str, base_url: &str) -> RawSocialMeta {
    let document = Html::parse_document(html_str);
    let parsed_base = Url::parse(base_url).ok();

    let mut meta = RawSocialMeta {
        og_tags: Vec::new(),
        twitter_tags: Vec::new(),
        og_title: None,
        og_description: None,
        og_image: None,
        og_image_width: None,
        og_image_height: None,
        og_url: None,
        og_type: None,
        og_site_name: None,
        og_locale: None,
        twitter_card: None,
        twitter_site: None,
        twitter_creator: None,
        twitter_title: None,
        twitter_description: None,
        twitter_image: None,
    };

    let meta_selector = Selector::parse("meta").unwrap();

    for el in document.select(&meta_selector) {
        let property = el.value().attr("property").map(|s| s.trim().to_string());
        let name = el.value().attr("name").map(|s| s.trim().to_string());
        let content = el.value().attr("content").unwrap_or("").trim().to_string();

        if content.is_empty() && property.is_none() && name.is_none() {
            continue;
        }

        let prop_lower = property.as_deref().unwrap_or("").to_lowercase();
        let name_lower = name.as_deref().unwrap_or("").to_lowercase();

        let key = if prop_lower.starts_with("og:") {
            prop_lower.as_str()
        } else if name_lower.starts_with("og:") {
            name_lower.as_str()
        } else {
            ""
        };

        if !key.is_empty() {
            meta.og_tags.push(MetaTag {
                name: name.clone(),
                property: property.clone(),
                content: content.clone(),
            });

            match key {
                "og:title" => meta.og_title = Some(content.clone()),
                "og:description" => meta.og_description = Some(content.clone()),
                "og:image" | "og:image:url" if meta.og_image.is_none() => {
                    meta.og_image = Some(resolve_url(&content, parsed_base.as_ref()));
                }
                "og:image:width" => meta.og_image_width = Some(content.clone()),
                "og:image:height" => meta.og_image_height = Some(content.clone()),
                "og:url" => meta.og_url = Some(resolve_url(&content, parsed_base.as_ref())),
                "og:type" => meta.og_type = Some(content.clone()),
                "og:site_name" => meta.og_site_name = Some(content.clone()),
                "og:locale" => meta.og_locale = Some(content.clone()),
                _ => {}
            }
        }

        let tw_key = if name_lower.starts_with("twitter:") {
            name_lower.as_str()
        } else if prop_lower.starts_with("twitter:") {
            prop_lower.as_str()
        } else {
            ""
        };

        if !tw_key.is_empty() {
            meta.twitter_tags.push(MetaTag {
                name: name.clone(),
                property: property.clone(),
                content: content.clone(),
            });

            match tw_key {
                "twitter:card" => meta.twitter_card = Some(content.clone()),
                "twitter:site" => meta.twitter_site = Some(content.clone()),
                "twitter:creator" => meta.twitter_creator = Some(content.clone()),
                "twitter:title" => meta.twitter_title = Some(content.clone()),
                "twitter:description" => meta.twitter_description = Some(content.clone()),
                "twitter:image" | "twitter:image:src" if meta.twitter_image.is_none() => {
                    meta.twitter_image = Some(resolve_url(&content, parsed_base.as_ref()));
                }
                _ => {}
            }
        }
    }

    meta
}
