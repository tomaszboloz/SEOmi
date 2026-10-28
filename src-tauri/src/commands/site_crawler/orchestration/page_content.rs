#[path = "page_content_inputs.rs"]
mod inputs;
#[path = "page_content_outcome.rs"]
mod outcome;
pub use inputs::ExtractPageContentInput;
pub use outcome::PageContentOutcome;

use scraper::{Html, Selector};

use super::super::{
    content_metrics::{content_metrics, ContentMetrics},
    focus_terms::extract_page_focus,
    models::{CrawledDuplicateHeading, CrawledPageFocus, CrawledPageIssue},
    semantic_chrome::has_semantic_content_root,
    semantic_terms::{semantic_status_is_topical, semantic_term_language},
    semantics::{extract_semantic_excerpts, extract_semantic_terms, semantic_content_source},
    simhash::content_simhash,
};
use super::page_headings::extract_page_headings;
use super::page_title_meta::extract_page_title_and_meta;
use super::page_type_guidance::thin_content_issue;
use super::template_signature;

pub fn extract_page_content(input: ExtractPageContentInput<'_>) -> PageContentOutcome {
    let ExtractPageContentInput {
        document,
        page_url,
        crawl_mode,
        body_len,
        status,
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
    let empty_document = (!is_html).then(|| Html::parse_document(""));
    let document = empty_document.as_ref().unwrap_or(document);
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
    let semantic_language = if is_html {
        semantic_term_language(document, document_language.as_deref())
    } else {
        None
    };
    let semantic_terms = if is_html && semantic_status_is_topical(status) {
        extract_semantic_terms(document, semantic_language.as_deref())
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
    if let Some(issue) = thin_content_issue(
        document,
        page_url,
        crawl_mode,
        status,
        is_html && !body_truncated && !body_read_failed,
        cm.word_count,
    ) {
        issues.push(issue);
    }

    let tm = extract_page_title_and_meta(
        document,
        is_html,
        title_selector,
        meta_desc_selector,
        issues,
    );
    let hd = extract_page_headings(document, is_html, h1_selector, headings_selector, issues);
    let focus = if is_html && semantic_status_is_topical(status) {
        extract_page_focus(
            document,
            semantic_language.as_deref(),
            tm.title.as_deref(),
            tm.meta_description.as_deref(),
        )
    } else {
        Default::default()
    };

    PageContentOutcome {
        document_language,
        word_count: cm.word_count,
        content_hash: cm.content_hash,
        text_ratio_percent: cm.text_ratio_percent,
        reading_time_minutes: cm.reading_time_minutes,
        content_simhash,
        semantic_terms,
        semantic_language,
        semantic_excerpts,
        focus: template_signature::attach(
            focus.with_js_shell(document, is_html.then_some(cm.word_count)),
            document,
            is_html && !body_truncated && !body_read_failed,
        ),
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
