use super::super::{
    page_assembler::assemble_page_summary,
    page_extra::{extract_page_extra, ExtractPageExtraInput},
    page_fetch::fetch_page_step,
    selectors::CrawlSelectors,
};
use super::discovery_http_fixture::{waf_route, DiscoveryServer};
use super::page_fixture::data;
use super::setup_config::default_crawl_config;
use super::*;
use crate::commands::site_crawler::fetch_types::{FetchedPageBody, FetchedResponse};
use crate::utils::test_app::StorageApp;
use scraper::Html;
use tauri::test::mock_builder;
use url::Url;

fn fetched(body: &str, final_url: &str) -> FetchedResponse {
    FetchedResponse {
        response: FetchedPageBody::Prefetched(Box::new(data(body))),
        final_url: final_url.into(),
        redirect_chain: Vec::new(),
        redirect_stopped_reason: None,
        request_duration_ms: None,
        retry_count: 0,
    }
}

#[tokio::test]
async fn coverage100_assembler_falls_back_to_final_url_for_bad_current_url() {
    let setup = setup(default_crawl_config(None));
    let mut state = state();
    assemble_page_summary(
        fetched(
            "<html><body><p>observed</p></body></html>",
            "https://example.test/final",
        ),
        11,
        "not a url",
        0,
        &CrawlSelectors::compile(),
        &setup,
        &mut state,
    )
    .await
    .unwrap();
    assert_eq!(state.pages.len(), 1);
    assert_eq!(state.pages[0].url, "not a url");
}

#[test]
fn coverage100_page_extra_uses_current_url_when_final_url_is_invalid() {
    let setup = setup(default_crawl_config(None));
    let document = Html::parse_document("<html><body><p>text</p></body></html>");
    let base = Url::parse("https://example.test/final").unwrap();
    let current = Url::parse("https://example.test/current").unwrap();
    let selectors = CrawlSelectors::compile();
    let mut state = state();
    let mut issues = Vec::new();
    let outcome = extract_page_extra(ExtractPageExtraInput {
        document: &document,
        text: "<html><body><p>text</p></body></html>",
        final_base: &base,
        final_url: "https://[broken",
        current_parsed: &current,
        charset: None,
        is_html: true,
        canonical_selector: &selectors.canonical,
        hreflang_selector: &selectors.hreflang,
        setup: &setup,
        state: &mut state,
        issues: &mut issues,
    });
    assert!(outcome.pagination_links.is_empty());
}

#[tokio::test]
async fn coverage100_page_fetch_records_waf_backoff_signal() {
    let server = DiscoveryServer::new(
        default_crawl_config(None),
        vec![waf_route(
            "/blocked",
            403,
            "blocked",
            "x-amzn-waf-action: block",
        )],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let mut state = CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    );
    let (result, _) = fetch_page_step(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state,
        None,
        &server.url("/blocked"),
    )
    .await;
    assert!(result.is_ok());
    assert!(state.backoff.effective_delay(None).is_some());
}
