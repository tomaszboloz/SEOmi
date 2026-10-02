use super::*;

pub(in crate::services::html_parser) fn extract_meta_tags(
    document: &Html,
    parsed_base: Option<&Url>,
) -> MetaTags {
    // 1. Extract <title>
    let title_selector = Selector::parse("title").unwrap();
    let title_text = document
        .select(&title_selector)
        .next()
        .map(|el| el.text().collect::<Vec<_>>().join(" ").trim().to_string());

    let title_len = title_text.as_ref().map(|t| t.chars().count()).unwrap_or(0);

    // 2. Parse all <meta> tags
    let meta_selector = Selector::parse("meta").unwrap();
    let mut description: Option<String> = None;
    let mut keywords: Option<String> = None;
    let mut robots: Option<String> = None;
    let mut viewport: Option<String> = None;
    let mut charset: Option<String> = None;
    let mut author: Option<String> = None;
    let mut generator: Option<String> = None;
    let mut theme_color: Option<String> = None;
    let mut other_tags = Vec::new();

    for el in document.select(&meta_selector) {
        let name = el.value().attr("name").map(|s| s.trim().to_string());
        let prop = el.value().attr("property").map(|s| s.trim().to_string());
        let http_equiv = el
            .value()
            .attr("http-equiv")
            .map(|s| s.trim().to_lowercase());
        let content = el.value().attr("content").unwrap_or("").trim().to_string();

        if let Some(cs) = el.value().attr("charset") {
            charset = Some(cs.trim().to_string());
        } else if http_equiv.as_deref() == Some("content-type") && charset.is_none() {
            if let Some(pos) = content.to_ascii_lowercase().find("charset=") {
                charset = Some(content[pos + 8..].trim().to_string());
            }
        }

        let name_lower = name.as_deref().unwrap_or("").to_lowercase();
        match name_lower.as_str() {
            "description" => description = Some(content.clone()),
            "keywords" => keywords = Some(content.clone()),
            "robots" => robots = Some(content.clone()),
            "viewport" => viewport = Some(content.clone()),
            "author" => author = Some(content.clone()),
            "generator" => generator = Some(content.clone()),
            "theme-color" => theme_color = Some(content.clone()),
            _ => {
                if !content.is_empty() || name.is_some() || prop.is_some() {
                    other_tags.push(MetaTag {
                        name: name.clone(),
                        property: prop.clone(),
                        content: content.clone(),
                    });
                }
            }
        }
    }

    // 3. Extract canonical URL (<link rel="canonical" href="...">)
    let canonical_selector = Selector::parse("link[rel~='canonical']").unwrap();
    let canonical = document
        .select(&canonical_selector)
        .next()
        .and_then(|el| el.value().attr("href"))
        .map(|href| resolve_url(href.trim(), parsed_base));

    let desc_len = description.as_ref().map(|d| d.chars().count()).unwrap_or(0);

    MetaTags {
        title: title_text,
        title_length: title_len,
        description,
        description_length: desc_len,
        keywords,
        robots,
        canonical,
        viewport,
        charset,
        author,
        generator,
        theme_color,
        other_tags,
    }
}
