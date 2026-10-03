use scraper::Html;
use url::Url;

use super::super::{
    fetch_data::read_fetched_page_data, fetch_types::FetchedResponse,
    html_decoding::decode_crawl_html_body, models::CrawledPageIssue,
};
use super::page_assembler_signals::extract_page_signals;
use super::page_discovery::resolve_page_discovery_sources;
use super::page_summary_builder::build_crawled_page_summary;
use super::selectors::CrawlSelectors;
use super::setup::CrawlSetup;
use super::state::CrawlLoopState;

pub async fn assemble_page_summary(
    fetched: FetchedResponse,
    page_duration: u64,
    current_url: &str,
    depth: usize,
    selectors: &CrawlSelectors,
    setup: &CrawlSetup,
    state: &mut CrawlLoopState,
) -> Result<(), String> {
    let FetchedResponse {
        response,
        final_url,
        redirect_chain,
        redirect_stopped_reason,
    } = fetched;
    let final_base =
        Url::parse(&final_url).map_err(|e| format!("Failed to parse final URL: {e}"))?;
    let current_parsed = Url::parse(current_url).unwrap_or_else(|_| final_base.clone());

    let page_data = read_fetched_page_data(response, setup.max_response_bytes).await;
    let page_duration = page_data
        .browser_navigation_time_ms
        .unwrap_or(page_duration);
    let is_html =
        page_data.declared_html && !page_data.body_truncated && !page_data.body_read_failed;
    let mut issues: Vec<CrawledPageIssue> = Vec::new();

    let (text, detected_charset, html_validation_findings) = if is_html {
        decode_crawl_html_body(&page_data.body, page_data.charset.as_deref())
    } else {
        (
            String::from_utf8_lossy(&page_data.body).into_owned(),
            None,
            Vec::new(),
        )
    };
    let document = Html::parse_document(&text);

    let mut signals = extract_page_signals(
        &document,
        &text,
        &page_data,
        &final_base,
        &final_url,
        current_url,
        &current_parsed,
        depth,
        redirect_chain.len(),
        redirect_stopped_reason.as_ref(),
        is_html,
        selectors,
        setup,
        state,
        &mut issues,
    );
    signals
        .extra
        .html_validation_findings
        .splice(0..0, html_validation_findings);

    let discovery_sources = resolve_page_discovery_sources(current_url, setup, state);

    let summary = build_crawled_page_summary(
        final_url,
        redirect_chain,
        redirect_stopped_reason,
        &page_data,
        page_duration,
        current_url,
        depth,
        setup.config.crawl_mode.as_str(),
        detected_charset,
        &signals.cm,
        signals.focus_phrase,
        signals.extra,
        signals.content,
        signals.meta,
        signals.links,
        signals.images,
        discovery_sources,
        issues,
    );
    state.pages.push(summary);

    Ok(())
}
