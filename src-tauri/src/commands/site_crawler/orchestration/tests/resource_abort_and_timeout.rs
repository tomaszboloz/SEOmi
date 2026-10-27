use super::super::resource_crawler::crawl_secondary_resources;
use super::discovery_http_fixture::{delayed_route, route, DiscoveryServer};
use super::resource_regressions::candidate;
use super::*;
use std::sync::Arc;
use std::time::{Duration, Instant};

#[tokio::test]
async fn concurrent_resource_fetch_aborts_on_cancellation() {
    let mut config = default_crawl_config(None);
    config.max_resource_requests = Some(2);
    config.max_concurrent_requests = Some(2);
    let server = DiscoveryServer::new(
        config,
        vec![
            route("/fast", 200, "fast"),
            delayed_route("/slow", 200, "slow", 500),
        ],
    )
    .await;
    let control = Arc::new(CrawlControl::new());
    let run_id = server.setup.run_id.clone();
    let cancelling_control = control.clone();
    let cancel = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(15)).await;
        cancelling_control
            .cancelled_runs
            .lock()
            .unwrap()
            .insert(run_id);
    });
    let mut state = state();
    for path in ["/fast", "/slow"] {
        let url = server.url(path);
        state
            .resource_candidates
            .insert(url.clone(), candidate(url));
    }
    let (resources, limited) =
        crawl_secondary_resources(&server.setup, &control, &mut state, None).await;
    cancel.await.unwrap();
    assert!(!limited);
    assert!(!state.timed_out);
    assert!(resources.len() <= 1);
    assert!(!resources.iter().any(|r| r.url == server.url("/slow")));
}

#[tokio::test]
async fn concurrent_resource_fetch_aborts_on_timeout() {
    let mut config = default_crawl_config(None);
    config.max_resource_requests = Some(2);
    config.max_concurrent_requests = Some(2);
    let mut server = DiscoveryServer::new(
        config,
        vec![
            delayed_route("/fast", 200, "fast", 30),
            delayed_route("/slow", 200, "slow", 500),
        ],
    )
    .await;
    server.setup.max_run_seconds = Some(1);
    server.setup.start_time = Instant::now() - Duration::from_millis(985);
    let mut state = state();
    for path in ["/fast", "/slow"] {
        let url = server.url(path);
        state
            .resource_candidates
            .insert(url.clone(), candidate(url));
    }
    let (resources, limited) =
        crawl_secondary_resources(&server.setup, &CrawlControl::new(), &mut state, None).await;
    assert!(!limited);
    assert!(state.timed_out);
    assert!(resources.len() <= 1);
    assert!(!resources.iter().any(|r| r.url == server.url("/slow")));
}
