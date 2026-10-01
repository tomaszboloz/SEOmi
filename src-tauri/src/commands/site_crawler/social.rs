use super::*;

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
        .collect();

    (favicons, social_meta_tags)
}

/// Extract the same favicon declaration metadata as the single-page audit,
/// while keeping this crawler's legacy URL list stable for persisted runs.
pub(super) fn crawl_favicon_metadata(document: &Html, base_url: &url::Url) -> Vec<FaviconData> {
    let Ok(selector) = Selector::parse("link[rel][href]") else {
        return Vec::new();
    };
    document
        .select(&selector)
        .filter_map(|element| {
            let value = element.value();
            let rel = value.attr("rel")?.trim();
            let rel_lower = rel.to_ascii_lowercase();
            if !rel_lower.split_ascii_whitespace().any(|token| {
                matches!(
                    token,
                    "icon" | "shortcut" | "apple-touch-icon" | "mask-icon"
                )
            }) {
                return None;
            }
            let raw_href = value.attr("href")?.trim();
            if raw_href.is_empty() {
                return None;
            }
            let resolved = if raw_href.to_ascii_lowercase().starts_with("data:image/") {
                bounded_inline_image_uri(raw_href)
            } else {
                base_url
                    .join(raw_href)
                    .ok()
                    .filter(|url| matches!(url.scheme(), "http" | "https"))?
                    .to_string()
            };
            let clean_path = resolved
                .split('?')
                .next()
                .unwrap_or(&resolved)
                .split('#')
                .next()
                .unwrap_or(&resolved)
                .to_ascii_lowercase();
            let inferred_format = if clean_path.starts_with("data:image/") {
                clean_path
                    .trim_start_matches("data:image/")
                    .split([';', ','])
                    .next()
                    .filter(|format| !format.is_empty())
                    .map(str::to_string)
            } else {
                clean_path
                    .rsplit('.')
                    .next()
                    .filter(|extension| *extension != clean_path)
                    .map(str::to_string)
            };
            Some(FaviconData {
                href: resolved,
                rel: rel.to_string(),
                declared_type: value
                    .attr("type")
                    .map(str::trim)
                    .filter(|item| !item.is_empty())
                    .map(str::to_string),
                declared_sizes: value
                    .attr("sizes")
                    .map(str::trim)
                    .filter(|item| !item.is_empty())
                    .map(str::to_string),
                inferred_format,
            })
        })
        .fold(Vec::new(), |mut unique, favicon| {
            if !unique.iter().any(|existing: &FaviconData| {
                existing.href == favicon.href && existing.rel == favicon.rel
            }) {
                unique.push(favicon);
            }
            unique
        })
}

pub(super) fn crawl_frames(document: &Html, base_url: &url::Url) -> (Vec<CrawledFrame>, bool) {
    let Ok(selector) = Selector::parse("iframe") else {
        return (Vec::new(), false);
    };
    let mut frames = Vec::new();
    let mut truncated = false;
    for element in document.select(&selector) {
        if frames.len() >= MAX_IFRAMES_PER_PAGE {
            truncated = true;
            break;
        }
        let value = element.value();
        let src = value.attr("src").map(str::to_owned);
        let resolved_url = src
            .as_deref()
            .map(str::trim)
            .filter(|src| !src.is_empty())
            .and_then(|src| base_url.join(src).ok())
            .filter(|url| matches!(url.scheme(), "http" | "https"))
            .map(|url| url.to_string());
        frames.push(CrawledFrame {
            src,
            resolved_url,
            title: value.attr("title").map(str::to_owned),
            name: value.attr("name").map(str::to_owned),
            loading: value.attr("loading").map(str::to_owned),
            sandbox: value.attr("sandbox").map(str::to_owned),
            checked_in_run: false,
            http_status: None,
            request_error_kind: None,
        });
    }
    (frames, truncated)
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
