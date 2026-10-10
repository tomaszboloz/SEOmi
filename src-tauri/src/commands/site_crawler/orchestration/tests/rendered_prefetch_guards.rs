use super::super::rendered_prefetch::prefetch_rendered_pages;
use super::discovery_http_fixture::{delayed_route, DiscoveryServer};
use super::*;
use crate::utils::test_app::StorageApp;
use std::time::{Duration, Instant};
use tauri::test::{mock_builder, MockRuntime};

fn queued_state(urls: &[String]) -> CrawlLoopState<MockRuntime> {
    CrawlLoopState::new(
        Default::default(),
        urls.iter().cloned().map(|url| (url, 1)).collect(),
        Vec::new(),
        Default::default(),
        false,
        false,
    )
}

#[tokio::test]
async fn cancelled_prefetch_keeps_queued_urls_and_skips_http() {
    let mut config = default_crawl_config(Some(2));
    config.crawl_mode = "browser-rendered".into();
    let server = DiscoveryServer::new(config, vec![delayed_route("/one", 200, "one", 500)]).await;
    let urls = [server.url("/one"), server.url("/missing")];
    let mut state = queued_state(&urls);
    let control = CrawlControl::new();
    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert(server.setup.run_id.clone());
    let app = StorageApp::new(mock_builder());
    prefetch_rendered_pages(&app.handle(), &control, &server.setup, &mut state, 2, &[]).await;

    assert_eq!(
        state
            .queue
            .iter()
            .map(|(url, _)| url.clone())
            .collect::<Vec<_>>(),
        urls.to_vec()
    );
    assert!(state.prefetched_order.is_empty());
    assert!(state.prefetched_responses.is_empty());
    assert!(server.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn expired_prefetch_marks_timeout_without_consuming_queue_or_http() {
    let mut config = default_crawl_config(Some(2));
    config.crawl_mode = "browser-rendered".into();
    let mut server =
        DiscoveryServer::new(config, vec![delayed_route("/one", 200, "one", 500)]).await;
    server.setup.max_run_seconds = Some(1);
    server.setup.start_time = Instant::now() - Duration::from_secs(2);
    let urls = [server.url("/one"), server.url("/missing")];
    let mut state = queued_state(&urls);
    let app = StorageApp::new(mock_builder());
    prefetch_rendered_pages(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state,
        2,
        &[],
    )
    .await;

    assert!(state.timed_out);
    assert_eq!(
        state
            .queue
            .iter()
            .map(|(url, _)| url.clone())
            .collect::<Vec<_>>(),
        urls.to_vec()
    );
    assert!(state.prefetched_order.is_empty());
    assert!(server.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn prefetch_rendered_pages_returns_early_when_slots_under_two_or_queue_empty() {
    let mut config = default_crawl_config(Some(1));
    config.crawl_mode = "browser-rendered".into();
    let server = DiscoveryServer::new(config, vec![]).await;
    let mut state = queued_state(&[]);
    let app = StorageApp::new(mock_builder());

    prefetch_rendered_pages(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state,
        2,
        &[],
    )
    .await;
    assert!(state.prefetched_order.is_empty());

    let mut state2 = queued_state(&[server.url("/one")]);
    prefetch_rendered_pages(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state2,
        1,
        &[],
    )
    .await;
    assert!(state2.prefetched_order.is_empty());
}
