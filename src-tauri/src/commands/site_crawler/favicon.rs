use super::social::MAX_FAVICONS_PER_PAGE;
use super::*;

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
            if unique.len() < MAX_FAVICONS_PER_PAGE
                && !unique.iter().any(|existing: &FaviconData| {
                    existing.href == favicon.href && existing.rel == favicon.rel
                })
            {
                unique.push(favicon);
            }
            unique
        })
}
