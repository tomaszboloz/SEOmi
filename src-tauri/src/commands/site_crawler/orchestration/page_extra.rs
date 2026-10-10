#[path = "page_extra_inputs.rs"]
mod inputs;
pub use inputs::ExtractPageExtraInput;

use scraper::{Html, Selector};
use tauri::Runtime;
use url::Url;

use super::super::{
    html_validation::validate_crawl_html_with_charset,
    models::{
        CrawledFrame, CrawledHreflang, CrawledHtmlValidationFinding, CrawledPageIssue,
        CrawledPaginationLink, CrawledSchemaFinding, CrawledSchemaReference, CrawledSocialMetaTag,
        CrawledSocialResourceCheck,
    },
};
use super::page_extra_schema_pagination::extract_page_schema_and_pagination;
use super::page_extra_social::extract_page_social_and_frames;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;
use crate::models::audit_data::FaviconData;
use crate::services::custom_search::{
    extract_custom_search_results_with_html, CrawledCustomSearchResult,
};

pub struct PageExtraOutcome {
    pub favicons: Vec<String>,
    pub favicon_metadata: Vec<FaviconData>,
    pub favicon_resource_checks: Vec<CrawledSocialResourceCheck>,
    pub social_meta_tags: Vec<CrawledSocialMetaTag>,
    pub frames: Vec<CrawledFrame>,
    pub frames_truncated: bool,
    pub hreflangs: Vec<CrawledHreflang>,
    pub amp_url: Option<String>,
    pub pagination_links: Vec<CrawledPaginationLink>,
    pub pagination_declaration_count: usize,
    pub pagination_invalid_declaration_count: usize,
    pub pagination_next: Option<String>,
    pub pagination_prev: Option<String>,
    pub schema_types: Vec<String>,
    pub schema_syntax_errors: usize,
    pub schema_validation_findings: Vec<CrawledSchemaFinding>,
    pub schema_references: Vec<CrawledSchemaReference>,
    pub schema_validation_truncated: bool,
    pub custom_search_results: Vec<CrawledCustomSearchResult>,
    pub html_validation_findings: Vec<CrawledHtmlValidationFinding>,
    pub html_validation_truncated: bool,
}

pub fn extract_page_extra<R: Runtime>(input: ExtractPageExtraInput<'_, R>) -> PageExtraOutcome {
    let ExtractPageExtraInput {
        document,
        text,
        final_base,
        final_url,
        current_parsed,
        charset,
        is_html,
        canonical_selector,
        hreflang_selector,
        setup,
        state,
        issues,
    } = input;
    let (html_validation_findings, html_validation_truncated) = if is_html {
        validate_crawl_html_with_charset(
            document,
            text,
            &Url::parse(final_url).unwrap_or_else(|_| current_parsed.clone()),
            charset,
        )
    } else {
        (Vec::new(), false)
    };
    let custom_search_results = if is_html {
        extract_custom_search_results_with_html(
            document,
            Some(text),
            &setup.config.custom_searches,
            &mut state.custom_search_remaining_chars,
        )
    } else {
        Vec::new()
    };
    let social =
        extract_page_social_and_frames(document, final_base, final_url, is_html, setup, state);
    let schema_paged = extract_page_schema_and_pagination(
        document,
        final_base,
        is_html,
        canonical_selector,
        hreflang_selector,
        issues,
    );

    PageExtraOutcome {
        favicons: social.favicons,
        favicon_metadata: social.favicon_metadata,
        favicon_resource_checks: social.favicon_resource_checks,
        social_meta_tags: social.social_meta_tags,
        frames: social.frames,
        frames_truncated: social.frames_truncated,
        hreflangs: schema_paged.hreflangs,
        amp_url: schema_paged.amp_url,
        pagination_links: schema_paged.pagination_links,
        pagination_declaration_count: schema_paged.pagination_declaration_count,
        pagination_invalid_declaration_count: schema_paged.pagination_invalid_declaration_count,
        pagination_next: schema_paged.pagination_next,
        pagination_prev: schema_paged.pagination_prev,
        schema_types: schema_paged.schema_types,
        schema_syntax_errors: schema_paged.schema_syntax_errors,
        schema_validation_findings: schema_paged.schema_validation_findings,
        schema_references: schema_paged.schema_references,
        schema_validation_truncated: schema_paged.schema_validation_truncated,
        custom_search_results,
        html_validation_findings,
        html_validation_truncated,
    }
}
