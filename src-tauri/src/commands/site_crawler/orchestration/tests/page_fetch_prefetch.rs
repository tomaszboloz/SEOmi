use super::super::{
    page_assembler::assemble_page_summary, page_fetch::fetch_page_step, selectors::CrawlSelectors,
};
use super::discovery_http_fixture::{delayed_route, redirect, DiscoveryServer};
use super::setup_config::default_crawl_config;
use super::*;
use crate::commands::site_crawler::prefetch::prefetch_http_pages;
use crate::utils::test_app::StorageApp;
use std::collections::{HashMap, VecDeque};
use tauri::test::{mock_builder, MockRuntime};

#[tokio::test]
async fn prefetch_carries_final_request_duration_into_page_summary() {
    let mut config = default_crawl_config(Some(2));
    config.max_concurrent_requests = Some(2);
    let server = DiscoveryServer::new(
        config,
        vec![
            delayed_route(
                "/slow-final",
                200,
                "<html><body><h1>Delayed</h1></body></html>",
                40,
            ),
            redirect("/slow", "/slow-final"),
        ],
    )
    .await;
    let url = server.url("/slow");
    let mut queue = VecDeque::from([(url.clone(), 0)]);
    let mut prefetched_order = VecDeque::new();
    let mut prefetched_responses = HashMap::new();
    prefetch_http_pages(
        &mut queue,
        &mut prefetched_order,
        &mut prefetched_responses,
        2,
        2,
        0,
        &server.setup.client,
        &server.setup.base_host,
        server.setup.config.allow_subdomains,
        server.setup.config.scope_path.as_deref(),
        &server.setup.config.allowed_hosts,
        server.setup.max_redirects,
        &server.setup.config,
        &[],
    )
    .await;
    let mut state: CrawlLoopState<MockRuntime> = CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    );
    state
        .prefetched_responses
        .extend(prefetched_responses.into_iter());
    let app = StorageApp::new(mock_builder());
    let (result, duration) = fetch_page_step(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state,
        None,
        &url,
    )
    .await;
    let fetched = match result {
        Ok(fetched) => fetched,
        Err(error) => panic!("delayed prefetch failed: {}", error.message),
    };
    assert_eq!(fetched.redirect_chain.len(), 1);
    assert_eq!(fetched.final_url, server.url("/slow-final"));
    assert!(duration >= 20, "prefetch duration was {duration}ms");
    assemble_page_summary(
        fetched,
        duration,
        &url,
        0,
        &CrawlSelectors::compile(),
        &server.setup,
        &mut state,
    )
    .await
    .unwrap();
    assert!(state.pages[0].response_time_ms >= 20);
}
