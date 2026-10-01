use crate::models::audit_data::{
    AccessibilityAudit, ContentStats, FaviconData, HreflangTag, MetaTag, MetaTags, StructuredData,
    TechnicalData,
};
use anyhow::Result;
use scraper::{Html, Selector};
use url::Url;

mod accessibility;
mod content;
mod markup;
mod structured_data;
mod technologies;
use accessibility::extract_accessibility;
use content::extract_content_stats;
pub use markup::resolve_url;
use structured_data::extract_structured_data;
use technologies::detect_html_technologies;

pub struct ParsedHtmlData {
    pub meta_tags: MetaTags,
    pub technical: TechnicalData,
    pub structured_data: Vec<StructuredData>,
    pub content_stats: ContentStats,
    pub accessibility: AccessibilityAudit,
}

/// Parses HTML document and extracts meta tags, technical indicators, structured data, and content stats
pub fn parse_html(html_str: &str, base_url: &str) -> Result<ParsedHtmlData> {
    let document = Html::parse_document(html_str);
    let parsed_base = Url::parse(base_url).ok();

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
            if let Some(pos) = content.to_lowercase().find("charset=") {
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
        .map(|href| resolve_url(href.trim(), parsed_base.as_ref()));

    let desc_len = description.as_ref().map(|d| d.chars().count()).unwrap_or(0);

    let meta_tags = MetaTags {
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
    };

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
            let resolved = resolve_url(href, parsed_base.as_ref());
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
                clean_path
                    .rsplit('.')
                    .next()
                    .filter(|extension| *extension != clean_path)
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
    let favicon = favicons.first().map(|entry| entry.href.clone());

    // 5. Extract Hreflang tags (<link rel="alternate" hreflang="..." href="...">)
    let hreflang_selector = Selector::parse("link[rel~='alternate'][hreflang]").unwrap();
    let mut hreflang_tags = Vec::new();
    for el in document.select(&hreflang_selector) {
        if let (Some(lang), Some(href)) = (el.value().attr("hreflang"), el.value().attr("href")) {
            hreflang_tags.push(HreflangTag {
                hreflang: lang.trim().to_string(),
                href: resolve_url(href.trim(), parsed_base.as_ref()),
            });
        }
    }

    // 6. Infer robots.txt & sitemap.xml URLs
    let robots_txt_url = parsed_base.as_ref().map(|base| {
        format!(
            "{}://{}/robots.txt",
            base.scheme(),
            base.host_str().unwrap_or("")
        )
    });
    let sitemap_url = parsed_base.as_ref().map(|base| {
        format!(
            "{}://{}/sitemap.xml",
            base.scheme(),
            base.host_str().unwrap_or("")
        )
    });

    let technical = TechnicalData {
        content_type: None, // Filled by http headers later
        server: None,
        favicon,
        favicons,
        robots_txt_url,
        sitemap_url,
        hreflang_tags,
        technology_signals: detect_html_technologies(
            &document,
            html_str,
            meta_tags.generator.as_deref(),
        ),
    };

    // 7. Extract Structured Data (JSON-LD and Microdata)
    let structured_data = extract_structured_data(&document);

    // 8. Extract Content Statistics
    let document_language = document
        .select(&Selector::parse("html").expect("static html selector is valid"))
        .next()
        .and_then(|element| element.value().attr("lang"));
    let content_stats = extract_content_stats(&document, html_str.len(), document_language);
    let accessibility = extract_accessibility(&document, html_str);

    Ok(ParsedHtmlData {
        meta_tags,
        technical,
        structured_data,
        content_stats,
        accessibility,
    })
}

#[cfg(test)]
mod tests;
