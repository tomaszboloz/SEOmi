use crate::models::audit_data::{
    AccessibilityAudit, ContentStats, FaviconData, HreflangTag, MetaTag, MetaTags, StructuredData,
    TechnicalData,
};
use anyhow::Result;
use scraper::{Html, Selector};
use url::Url;

mod accessibility;
mod content;
mod discovery;
mod favicons;
mod markup;
mod metadata;
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

use discovery::{extract_hreflang, root_discovery_urls};
use favicons::extract_favicons;
use metadata::extract_meta_tags;

/// Parses the fetched document into independent metadata and evidence contracts.
pub fn parse_html(html_str: &str, base_url: &str) -> Result<ParsedHtmlData> {
    let document = Html::parse_document(html_str);
    let parsed_base = Url::parse(base_url).ok();
    let meta_tags = extract_meta_tags(&document, parsed_base.as_ref());
    let favicons = extract_favicons(&document, parsed_base.as_ref());
    let (robots_txt_url, sitemap_url) = root_discovery_urls(parsed_base.as_ref());
    let technical = TechnicalData {
        content_type: None,
        server: None,
        favicon: favicons.first().map(|entry| entry.href.clone()),
        favicons,
        robots_txt_url,
        sitemap_url,
        hreflang_tags: extract_hreflang(&document, parsed_base.as_ref()),
        technology_signals: detect_html_technologies(
            &document,
            html_str,
            meta_tags.generator.as_deref(),
        ),
    };
    let document_language = document
        .select(&Selector::parse("html").expect("static html selector is valid"))
        .next()
        .and_then(|element| element.value().attr("lang"));
    Ok(ParsedHtmlData {
        meta_tags,
        technical,
        structured_data: extract_structured_data(&document),
        content_stats: extract_content_stats(&document, html_str.len(), document_language),
        accessibility: extract_accessibility(&document, html_str),
    })
}

#[cfg(test)]
mod tests;
