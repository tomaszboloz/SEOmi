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

#[tokio::test]
async fn prefetch_records_fetch_failure_for_unreachable_target() {
    let mut config = default_crawl_config(Some(2));
    config.max_concurrent_requests = Some(2);
    let server = DiscoveryServer::new(config.clone(), vec![]).await;
    let unreachable_url = "http://127.0.0.1:1/unreachable".to_string();
    let unreachable_url_two = "http://127.0.0.1:1/unreachable-two".to_string();
    let mut queue = VecDeque::from([
        (unreachable_url.clone(), 0),
        (unreachable_url_two.clone(), 0),
    ]);
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
        "127.0.0.1",
        false,
        None,
        &[],
        1,
        &config,
        &[],
    )
    .await;
    assert_eq!(prefetched_responses.len(), 2);
    assert!(prefetched_responses.get(&unreachable_url).unwrap().is_err());
    assert!(prefetched_responses
        .get(&unreachable_url_two)
        .unwrap()
        .is_err());
}
