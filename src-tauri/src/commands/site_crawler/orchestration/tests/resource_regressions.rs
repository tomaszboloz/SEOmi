use super::super::resource_crawler::crawl_secondary_resources;
use super::discovery_http_fixture::{route, DiscoveryServer};
use super::*;
use crate::commands::site_crawler::models::ResourceCandidate;

pub fn candidate(url: String) -> ResourceCandidate {
    ResourceCandidate {
        url,
        resource_type: "stylesheet".into(),
        source_urls: vec!["https://example.test/page".into()],
    }
}

#[tokio::test]
async fn expired_resource_phase_does_not_start_http_requests() {
    let mut server = DiscoveryServer::new(
        default_crawl_config(None),
        vec![route("/style.css", 200, "body {}")],
    )
    .await;
    server.setup.max_run_seconds = Some(1);
    server.setup.start_time = std::time::Instant::now() - std::time::Duration::from_secs(2);
    let mut state = state();
    let url = server.url("/style.css");
    state
        .resource_candidates
        .insert(url.clone(), candidate(url));
    let (resources, limited) =
        crawl_secondary_resources(&server.setup, &CrawlControl::new(), &mut state, None).await;
    assert!(resources.is_empty());
    assert!(!limited);
    assert!(state.timed_out);
    assert!(
        server.requests.lock().unwrap().is_empty(),
        "expired phase sent a request"
    );
}

#[tokio::test]
async fn cancelled_resource_phase_does_not_start_http_requests() {
    let server = DiscoveryServer::new(
        default_crawl_config(None),
        vec![route("/style.css", 200, "body {}")],
    )
    .await;
    let control = CrawlControl::new();
    control
        .cancelled_runs
        .lock()
        .unwrap()
        .insert(server.setup.run_id.clone());
    let mut state = state();
    let url = server.url("/style.css");
    state
        .resource_candidates
        .insert(url.clone(), candidate(url));
    let (resources, limited) =
        crawl_secondary_resources(&server.setup, &control, &mut state, None).await;
    assert!(resources.is_empty());
    assert!(!limited);
    assert!(!state.timed_out);
    assert!(
        server.requests.lock().unwrap().is_empty(),
        "cancelled phase sent a request"
    );
}
