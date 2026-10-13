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

#[tokio::test]
async fn prefetch_with_an_empty_queue_returns_without_work() {
    let mut config = default_crawl_config(Some(4));
    config.crawl_mode = "browser-rendered".into();
    let server = DiscoveryServer::new(config, vec![]).await;
    let mut state = queued_state(&[]);
    let app = StorageApp::new(mock_builder());
    let control = CrawlControl::new();
    prefetch_rendered_pages(&app.handle(), &control, &server.setup, &mut state, 4, &[]).await;
    assert!(state.prefetched_order.is_empty());
    assert!(server.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn panicked_prefetch_tasks_become_fetch_failures_for_their_url() {
    use super::super::rendered_prefetch_failure::record_task_failure;
    let mut tasks = tokio::task::JoinSet::new();
    let handle = tasks.spawn(async { panic!("renderer exploded") });
    let mut urls = std::collections::HashMap::new();
    urls.insert(handle.id(), "https://example.test/a".to_string());
    let error = tasks.join_next().await.unwrap().unwrap_err();
    let mut state = queued_state(&[]);
    record_task_failure(&mut state, &mut urls, &error);
    let failure = state.prefetched_responses["https://example.test/a"]
        .as_ref()
        .err()
        .unwrap();
    assert_eq!(failure.kind, "prefetch_task");
    assert!(urls.is_empty());
    record_task_failure(&mut state, &mut urls, &error);
    assert_eq!(state.prefetched_responses.len(), 1);
}
