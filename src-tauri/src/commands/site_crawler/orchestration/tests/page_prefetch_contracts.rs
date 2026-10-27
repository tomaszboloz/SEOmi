use super::super::page_prefetch::{prefetch_next_window, prefetch_parallelism};
use super::discovery_http_fixture::DiscoveryServer;
use super::*;
use crate::utils::test_app::StorageApp;
use std::time::{Duration, Instant};
use tauri::test::{mock_builder, MockRuntime};

#[test]
fn prefetch_parallelism_branches_and_defaults() {
    let mut config = default_crawl_config(None);
    config.max_concurrent_requests = Some(8);

    config.crawl_mode = "unknown-mode".into();
    assert_eq!(prefetch_parallelism(&config, None), 1);

    config.crawl_mode = "http".into();
    assert_eq!(prefetch_parallelism(&config, None), 8);
    assert_eq!(
        prefetch_parallelism(&config, Some(Duration::from_secs(2))),
        1
    );

    config.crawl_mode = "browser-rendered".into();
    assert_eq!(prefetch_parallelism(&config, None), 6);
}

#[tokio::test]
async fn prefetch_next_window_routes_to_rendered_prefetch() {
    let mut config = default_crawl_config(Some(2));
    config.crawl_mode = "browser-rendered".into();
    config.max_concurrent_requests = Some(2);
    let server = DiscoveryServer::new(config, vec![]).await;
    let url1 = server.url("/page1");
    let url2 = server.url("/page2");
    let mut state: CrawlLoopState<MockRuntime> = CrawlLoopState::new(
        Default::default(),
        vec![(url1.clone(), 0), (url2.clone(), 0)].into(),
        Vec::new(),
        Default::default(),
        false,
        false,
    );
    let control = CrawlControl::new();
    let app = StorageApp::new(mock_builder());

    prefetch_next_window(&app.handle(), &control, &server.setup, &mut state, &[], 2).await;

    assert_eq!(state.prefetched_order.len(), 2);
}

#[tokio::test]
async fn prefetch_next_window_early_returns_on_guards() {
    let mut config = default_crawl_config(Some(2));
    config.crawl_mode = "browser-rendered".into();
    let mut server = DiscoveryServer::new(config, vec![]).await;
    let url1 = server.url("/page1");
    let app = StorageApp::new(mock_builder());

    // 1. parallelism < 2
    let mut state: CrawlLoopState<MockRuntime> = CrawlLoopState::new(
        Default::default(),
        vec![(url1.clone(), 0)].into(),
        Vec::new(),
        Default::default(),
        false,
        false,
    );
    let control = CrawlControl::new();
    prefetch_next_window(&app.handle(), &control, &server.setup, &mut state, &[], 1).await;
    assert!(state.prefetched_order.is_empty());

    // 2. state.timed_out
    state.timed_out = true;
    prefetch_next_window(&app.handle(), &control, &server.setup, &mut state, &[], 2).await;
    assert!(state.prefetched_order.is_empty());

    // 3. control cancelled
    state.timed_out = false;
    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert(server.setup.run_id.clone());
    prefetch_next_window(&app.handle(), &control, &server.setup, &mut state, &[], 2).await;
    assert!(state.prefetched_order.is_empty());

    // 4. deadline reached
    control.cancelled_runs.lock().unwrap().clear();
    server.setup.max_run_seconds = Some(1);
    server.setup.start_time = Instant::now() - Duration::from_secs(2);
    prefetch_next_window(&app.handle(), &control, &server.setup, &mut state, &[], 2).await;
    assert!(state.prefetched_order.is_empty());
}
