#[path = "page_assembler_signals_inputs.rs"]
mod inputs;
pub use inputs::ExtractPageSignalsInput;

use scraper::Html;
use tauri::Runtime;
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

pub fn extract_page_signals<R: Runtime>(
    input: ExtractPageSignalsInput<'_, R>,
) -> AssembledPageSignals {
    let ExtractPageSignalsInput {
        document,
        text,
        page_data,
        final_base,
        final_url,
        current_url,
        current_parsed,
        depth,
        redirect_chain_len,
        redirect_stopped_reason,
        is_html,
        selectors,
        setup,
        state,
        issues,
    } = input;
    let extra = extract_page_extra(super::page_extra::ExtractPageExtraInput {
        document,
        text,
        final_base,
        final_url,
        current_parsed,
        charset: page_data.charset.as_deref(),
        is_html,
        canonical_selector: &selectors.canonical,
        hreflang_selector: &selectors.hreflang,
        setup,
        state,
        issues,
    });

    let content = extract_page_content(super::page_content::ExtractPageContentInput {
        document,
        page_url: final_url,
        crawl_mode: &setup.config.crawl_mode,
        body_len: page_data.body.len(),
        status: page_data.status,
        is_html,
        body_truncated: page_data.body_truncated,
        body_read_failed: page_data.body_read_failed,
        html_selector: &selectors.html,
        title_selector: &selectors.title,
        h1_selector: &selectors.h1,
        headings_selector: &selectors.headings,
        meta_desc_selector: &selectors.meta_desc,
        issues,
    });

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

    let meta = extract_page_metadata(super::page_metadata::ExtractPageMetadataInput {
        page_data,
        document,
        final_base,
        final_url,
        current_url,
        redirect_chain_len,
        redirect_stopped_reason,
        pagination_declaration_count: extra.pagination_declaration_count,
        pagination_invalid_declaration_count: extra.pagination_invalid_declaration_count,
        config: &setup.config,
        robots_selector: &selectors.robots,
        meta_refresh_selector: &selectors.meta_refresh,
        issues,
    });

    let assets = extract_page_assets(super::page_assembler_assets::ExtractPageAssetsInput {
        document,
        final_base,
        final_url,
        depth,
        has_primary_content_root: content.has_primary_content_root,
        is_html,
        extra: &extra,
        selectors,
        setup,
        state,
        issues,
    });

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
