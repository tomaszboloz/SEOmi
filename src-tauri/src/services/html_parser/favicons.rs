use super::*;

pub(in crate::services::html_parser) fn extract_favicons(
    document: &Html,
    parsed_base: Option<&Url>,
) -> Vec<FaviconData> {
    // 4. Extract Favicon
    let favicon_selector = Selector::parse("link[rel]").unwrap();
    let favicons = document
        .select(&favicon_selector)
        .filter_map(|element| {
            let rel = element.value().attr("rel")?.trim();
            let rel_lower = rel.to_ascii_lowercase();
            if !rel_lower.split_ascii_whitespace().any(|token| {
                token == "icon"
                    || token == "shortcut"
                    || token == "apple-touch-icon"
                    || token == "mask-icon"
            }) {
                return None;
            }
            let href = element.value().attr("href")?.trim();
            if href.is_empty() {
                return None;
            }
            let resolved = resolve_url(href, parsed_base);
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
                    .split(';')
                    .next()
                    .filter(|value| !value.is_empty())
                    .map(str::to_string)
            } else {
                let path = Url::parse(&clean_path)
                    .ok()
                    .map(|url| url.path().to_string())
                    .unwrap_or_else(|| clean_path.clone());
                path.rsplit('/')
                    .next()
                    .and_then(|filename| filename.rsplit_once('.'))
                    .map(|(_, extension)| extension)
                    .filter(|extension| !extension.is_empty())
                    .map(str::to_string)
            };
            Some(FaviconData {
                href: resolved,
                rel: rel.to_string(),
                declared_type: element
                    .value()
                    .attr("type")
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string),
                declared_sizes: element
                    .value()
                    .attr("sizes")
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
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
        });

    favicons
}
