#[path = "page_content_inputs.rs"]
mod inputs;
pub use inputs::ExtractPageContentInput;

use scraper::{Html, Selector};

use super::super::{
    content_metrics::{content_metrics, ContentMetrics},
    models::{CrawledDuplicateHeading, CrawledPageIssue},
    semantic_chrome::has_semantic_content_root,
    semantics::{extract_semantic_excerpts, extract_semantic_terms, semantic_content_source},
    simhash::content_simhash,
};
use super::page_headings::extract_page_headings;
use super::page_title_meta::extract_page_title_and_meta;

pub struct PageContentOutcome {
    pub document_language: Option<String>,
    pub word_count: usize,
    pub content_hash: Option<String>,
    pub text_ratio_percent: Option<f64>,
    pub reading_time_minutes: Option<usize>,
    pub content_simhash: Option<String>,
    pub semantic_terms: Vec<String>,
    pub semantic_excerpts: Vec<String>,
    pub has_primary_content_root: bool,
    pub semantic_content_source: String,
    pub title: Option<String>,
    pub title_length: Option<usize>,
    pub h1_count: usize,
    pub heading_counts: Vec<usize>,
    pub duplicate_headings: Vec<CrawledDuplicateHeading>,
    pub meta_description: Option<String>,
    pub meta_description_length: Option<usize>,
}

pub fn extract_page_content(input: ExtractPageContentInput<'_>) -> PageContentOutcome {
    let ExtractPageContentInput {
        document,
        body_len,
        is_html,
        body_truncated,
        body_read_failed,
        html_selector,
        title_selector,
        h1_selector,
        headings_selector,
        meta_desc_selector,
        issues,
    } = input;
    let document_language = document
        .select(html_selector)
        .next()
        .and_then(|el| el.value().attr("lang"))
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_owned);
    if is_html && document_language.is_none() {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: "Document has no html lang attribute".into(),
        });
    }

    let cm = if is_html {
        content_metrics(document, body_len, document_language.as_deref())
    } else {
        ContentMetrics::default()
    };
    let content_simhash = is_html.then(|| content_simhash(document)).flatten();
    let semantic_terms = if is_html {
        extract_semantic_terms(document)
    } else {
        Vec::new()
    };
    let semantic_excerpts = if is_html {
        extract_semantic_excerpts(document)
    } else {
        Vec::new()
    };
    let has_primary_content_root = is_html && has_semantic_content_root(document);
    let semantic_content_source =
        semantic_content_source(document, is_html, body_truncated, body_read_failed);
    if is_html && cm.word_count < 50 {
        issues.push(CrawledPageIssue {
            severity: "Info".into(),
            message: format!("Thin text content: {} words", cm.word_count),
        });
    }

    let tm = extract_page_title_and_meta(
        document,
        is_html,
        title_selector,
        meta_desc_selector,
        issues,
    );
    let hd = extract_page_headings(document, is_html, h1_selector, headings_selector, issues);

    PageContentOutcome {
        document_language,
        word_count: cm.word_count,
        content_hash: cm.content_hash,
        text_ratio_percent: cm.text_ratio_percent,
        reading_time_minutes: cm.reading_time_minutes,
        content_simhash,
        semantic_terms,
        semantic_excerpts,
        has_primary_content_root,
        semantic_content_source,
        title: tm.title,
        title_length: tm.title_length,
        h1_count: hd.h1_count,
        heading_counts: hd.heading_counts,
        duplicate_headings: hd.duplicate_headings,
        meta_description: tm.meta_description,
        meta_description_length: tm.meta_description_length,
    }
}
