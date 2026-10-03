use super::*;

pub(in crate::services::html_parser) fn extract_hreflang(
    document: &Html,
    parsed_base: Option<&Url>,
) -> Vec<HreflangTag> {
    // 5. Extract Hreflang tags (<link rel="alternate" hreflang="..." href="...">)
    let hreflang_selector = Selector::parse("link[rel~='alternate'][hreflang]").unwrap();
    let mut hreflang_tags = Vec::new();
    for el in document.select(&hreflang_selector) {
        if let (Some(lang), Some(href)) = (el.value().attr("hreflang"), el.value().attr("href")) {
            hreflang_tags.push(HreflangTag {
                hreflang: lang.trim().to_string(),
                href: resolve_url(href.trim(), parsed_base),
            });
        }
    }

    hreflang_tags
}

pub(in crate::services::html_parser) fn root_discovery_urls(
    base: Option<&Url>,
) -> (Option<String>, Option<String>) {
    let origin = base
        .filter(|base| matches!(base.scheme(), "http" | "https"))
        .map(|base| base.origin().ascii_serialization());
    (
        origin.as_ref().map(|origin| format!("{origin}/robots.txt")),
        origin.map(|origin| format!("{origin}/sitemap.xml")),
    )
}
