use scraper::Html;
use url::Url;

use super::super::{
    content_metrics::{content_metrics, ContentMetrics},
    content_terms::focus_phrase_evidence,
    fetch_types::FetchedPageData,
    models::{CrawledFocusPhraseEvidence, CrawledImage, CrawledPageIssue},
};
use super::page_assembler_assets::extract_page_assets;
use super::page_content::{extract_page_content, PageContentOutcome};
use super::page_extra::{extract_page_extra, PageExtraOutcome};
use super::page_links::PageLinksOutcome;
use super::page_metadata::{extract_page_metadata, PageMetadataOutcome};
use super::selectors::CrawlSelectors;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub struct AssembledPageSignals {
    pub extra: PageExtraOutcome,
    pub content: PageContentOutcome,
    pub cm: ContentMetrics,
    pub focus_phrase: Option<CrawledFocusPhraseEvidence>,
    pub meta: PageMetadataOutcome,
    pub links: PageLinksOutcome,
    pub images: Vec<CrawledImage>,
}

pub fn extract_page_signals(
    document: &Html,
    text: &str,
    page_data: &FetchedPageData,
    final_base: &Url,
    final_url: &str,
    current_url: &str,
    current_parsed: &Url,
    depth: usize,
    redirect_chain_len: usize,
    redirect_stopped_reason: Option<&String>,
    is_html: bool,
    selectors: &CrawlSelectors,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
    issues: &mut Vec<CrawledPageIssue>,
) -> AssembledPageSignals {
    let extra = extract_page_extra(
        document,
        text,
        final_base,
        final_url,
        current_parsed,
        page_data.charset.as_deref(),
        is_html,
        &selectors.canonical,
        &selectors.hreflang,
        setup,
        state,
        issues,
    );

    let content = extract_page_content(
        document,
        page_data.body.len(),
        is_html,
        page_data.body_truncated,
        page_data.body_read_failed,
        &selectors.html,
        &selectors.title,
        &selectors.h1,
        &selectors.headings,
        &selectors.meta_desc,
        issues,
    );

    let cm = if is_html {
        content_metrics(
            document,
            page_data.body.len(),
            content.document_language.as_deref(),
        )
    } else {
        ContentMetrics::default()
    };
    let focus_phrase = if is_html {
        focus_phrase_evidence(
            document,
            content.title.as_deref(),
            content.meta_description.as_deref(),
            setup.config.focus_phrase.as_deref(),
        )
    } else {
        None
    };

    let meta = extract_page_metadata(
        page_data,
        document,
        final_base,
        final_url,
        current_url,
        redirect_chain_len,
        redirect_stopped_reason,
        extra.pagination_declaration_count,
        extra.pagination_invalid_declaration_count,
        &setup.config,
        &selectors.canonical,
        &selectors.robots,
        &selectors.meta_refresh,
        issues,
    );

    let assets = extract_page_assets(
        document,
        final_base,
        final_url,
        depth,
        content.has_primary_content_root,
        is_html,
        &extra,
        selectors,
        setup,
        state,
        issues,
    );

    AssembledPageSignals {
        extra,
        content,
        cm,
        focus_phrase,
        meta,
        links: assets.links,
        images: assets.images,
    }
}
