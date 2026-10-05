use super::*;

/// Real pages declare a handful of icons and a few dozen og:/twitter: tags.
/// Hostile pages can declare thousands; each would be stored, deduplicated in
/// quadratic time and, for image tags, queued for a resource check.
pub(super) const MAX_FAVICONS_PER_PAGE: usize = 50;
pub(super) const MAX_SOCIAL_META_TAGS_PER_PAGE: usize = 200;

pub(super) fn crawl_social_metadata(
    document: &Html,
    base_url: &url::Url,
) -> (Vec<String>, Vec<CrawledSocialMetaTag>) {
    let Ok(link_selector) = Selector::parse("link[rel][href]") else {
        return (Vec::new(), Vec::new());
    };
    let Ok(meta_selector) = Selector::parse("meta[property], meta[name]") else {
        return (Vec::new(), Vec::new());
    };

    let mut favicons = Vec::new();
    for element in document.select(&link_selector) {
        let rel_tokens = element
            .value()
            .attr("rel")
            .unwrap_or_default()
            .split_ascii_whitespace()
            .map(str::to_ascii_lowercase)
            .collect::<HashSet<_>>();
        let is_icon = rel_tokens.contains("icon")
            || rel_tokens.contains("apple-touch-icon")
            || rel_tokens.contains("mask-icon");
        if !is_icon {
            continue;
        }
        let Some(href) = element
            .value()
            .attr("href")
            .map(str::trim)
            .filter(|href| !href.is_empty())
        else {
            continue;
        };
        let Some(icon_url) = base_url
            .join(href)
            .ok()
            .filter(|url| matches!(url.scheme(), "http" | "https"))
            .map(|url| url.to_string())
        else {
            continue;
        };
        if !favicons.contains(&icon_url) {
            favicons.push(icon_url);
            if favicons.len() >= MAX_FAVICONS_PER_PAGE {
                break;
            }
        }
    }

    let social_meta_tags = document
        .select(&meta_selector)
        .flat_map(|element| {
            let value = element.value();
            [value.attr("property"), value.attr("name")]
                .into_iter()
                .flatten()
                .filter_map(|attribute| {
                    let key = attribute.trim().to_ascii_lowercase();
                    if !key.starts_with("og:") && !key.starts_with("twitter:") {
                        return None;
                    }
                    let content = value
                        .attr("content")
                        .map(str::trim)
                        .map(str::to_owned)
                        .map(|content| resolve_social_metadata_url(&key, content, base_url));
                    let resource_check = is_social_image_meta_key(&key)
                        .then_some(content.as_deref())
                        .flatten()
                        .filter(|url| matches!(url::Url::parse(url), Ok(parsed) if matches!(parsed.scheme(), "http" | "https")))
                        .map(unchecked_social_resource);
                    Some(CrawledSocialMetaTag {
                        key,
                        content,
                        resource_check,
                    })
                })
        })
        .take(MAX_SOCIAL_META_TAGS_PER_PAGE)
        .collect();

    (favicons, social_meta_tags)
}

pub(super) fn resolve_social_metadata_url(
    key: &str,
    content: String,
    base_url: &url::Url,
) -> String {
    let is_url = matches!(
        key,
        "og:url"
            | "og:image"
            | "og:image:url"
            | "og:image:secure_url"
            | "og:audio"
            | "og:video"
            | "twitter:image"
            | "twitter:image:src"
    );
    if !is_url {
        return content;
    }
    base_url
        .join(&content)
        .ok()
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(|url| url.to_string())
        .unwrap_or(content)
}

pub(super) fn is_social_image_meta_key(key: &str) -> bool {
    matches!(
        key,
        "og:image" | "og:image:url" | "og:image:secure_url" | "twitter:image" | "twitter:image:src"
    )
}

pub(super) fn unchecked_social_resource(url: &str) -> CrawledSocialResourceCheck {
    CrawledSocialResourceCheck {
        url: url.to_owned(),
        checked_in_run: false,
        http_status: None,
        content_type: None,
        content_length: None,
        intrinsic_width: None,
        intrinsic_height: None,
        dimensions_source: None,
        request_error_kind: None,
    }
}
