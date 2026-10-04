use super::super::resource_crawler::crawl_secondary_resources;
use super::discovery_http_fixture::{route, DiscoveryServer};
use super::resource_regressions::candidate;
use super::*;
use std::{
    sync::Arc,
    time::{Duration, Instant},
};

#[tokio::test]
async fn cancellation_during_robots_delay_finishes_without_a_request() {
    let server =
        DiscoveryServer::new(default_crawl_config(None), vec![route("/a", 200, "a")]).await;
    let control = Arc::new(CrawlControl::new());
    let cancelled_control = control.clone();
    let run_id = server.setup.run_id.clone();
    let cancel = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(30)).await;
        cancelled_control
            .cancelled_runs
            .lock()
            .unwrap()
            .insert(run_id);
    });
    let mut state = state();
    let initial_request = Instant::now();
    state.last_page_request_at = Some(initial_request);
    let url = server.url("/a");
    state
        .resource_candidates
        .insert(url.clone(), candidate(url));
    let (resources, limited) = crawl_secondary_resources(
        &server.setup,
        &control,
        &mut state,
        Some(Duration::from_secs(5)),
    )
    .await;
    cancel.await.unwrap();
    assert!(resources.is_empty());
    assert!(!limited);
    assert!(!state.timed_out);
    assert_eq!(state.last_page_request_at, Some(initial_request));
    assert!(server.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn deadline_after_pause_is_rechecked_before_any_request() {
    for delay in [None, Some(Duration::ZERO)] {
        let mut server =
            DiscoveryServer::new(default_crawl_config(None), vec![route("/a", 200, "a")]).await;
        server.setup.max_run_seconds = Some(1);
        server.setup.start_time = Instant::now();
        let control = Arc::new(CrawlControl::new());
        control.pause(&server.setup.run_id);
        let resumed_control = control.clone();
        let run_id = server.setup.run_id.clone();
        let resume = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(1100)).await;
            resumed_control.resume(&run_id);
        });
        let mut state = state();
        let url = server.url("/a");
        state
            .resource_candidates
            .insert(url.clone(), candidate(url));
        let (resources, limited) =
            crawl_secondary_resources(&server.setup, &control, &mut state, delay).await;
        resume.await.unwrap();
        assert!(resources.is_empty());
        assert!(!limited);
        assert!(state.timed_out);
        assert!(server.requests.lock().unwrap().is_empty());
    }
}

#[tokio::test]
async fn deadline_during_robots_delay_does_not_send_late_request() {
    let mut server =
        DiscoveryServer::new(default_crawl_config(None), vec![route("/a", 200, "a")]).await;
    server.setup.max_run_seconds = Some(1);
    server.setup.start_time = Instant::now();
    let mut state = state();
    state.last_page_request_at = Some(Instant::now());
    let url = server.url("/a");
    state
        .resource_candidates
        .insert(url.clone(), candidate(url));
    let (resources, limited) = crawl_secondary_resources(
        &server.setup,
        &CrawlControl::new(),
        &mut state,
        Some(Duration::from_millis(1100)),
    )
    .await;
    assert!(resources.is_empty());
    assert!(!limited);
    assert!(state.timed_out);
    assert!(server.requests.lock().unwrap().is_empty());
}
