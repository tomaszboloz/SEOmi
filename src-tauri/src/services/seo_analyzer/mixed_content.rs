use crate::services::html_parser::resolve_url;
use scraper::{Html, Selector};
use url::Url;

pub fn detect_mixed_content_resources(html: &str, page_url: &Url) -> Vec<String> {
    if page_url.scheme() != "https" {
        return Vec::new();
    }
    let document = Html::parse_document(html);
    let selector = Selector::parse(
        "script[src], img[src], iframe[src], frame[src], source[src], video[src], audio[src], track[src], embed[src], object[data], form[action], link[rel~='stylesheet'][href], link[rel~='preload'][href]",
    )
    .expect("static embedded-resource selector is valid");
    let mut found = std::collections::BTreeSet::new();
    for element in document.select(&selector) {
        let attribute = if element.value().name() == "object" {
            "data"
        } else if element.value().name() == "form" {
            "action"
        } else if element.value().name() == "link" {
            "href"
        } else {
            "src"
        };
        if let Some(value) = element.value().attr(attribute) {
            collect_http_resource(value, page_url, &mut found);
        }
        if matches!(element.value().name(), "img" | "source") {
            if let Some(srcset) = element.value().attr("srcset") {
                for candidate in srcset.split(',') {
                    if let Some(value) = candidate.split_ascii_whitespace().next() {
                        collect_http_resource(value, page_url, &mut found);
                    }
                }
            }
        }
    }
    let style_selector = Selector::parse("[style]").expect("static style selector is valid");
    for element in document.select(&style_selector) {
        if let Some(style) = element.value().attr("style") {
            for candidate in style.split("url(").skip(1) {
                let value = candidate
                    .trim_start_matches([' ', '\'', '"'])
                    .split([')', '\'', '"'])
                    .next()
                    .unwrap_or_default()
                    .trim();
                collect_http_resource(value, page_url, &mut found);
            }
        }
    }
    found.into_iter().take(100).collect()
}

pub(super) fn collect_http_resource(
    value: &str,
    page_url: &Url,
    output: &mut std::collections::BTreeSet<String>,
) {
    let value = value.trim();
    if value.is_empty() || value.starts_with("data:") || value.starts_with("blob:") {
        return;
    }
    let Ok(mut resolved) = Url::parse(&resolve_url(value, Some(page_url))) else {
        return;
    };
    if resolved.scheme() != "http" {
        return;
    }
    resolved.set_query(None);
    resolved.set_fragment(None);
    output.insert(resolved.to_string());
}

#[cfg(test)]
#[path = "mixed_content_tests.rs"]
mod tests;
