use super::super::resource_crawler::crawl_secondary_resources;
use super::discovery_http_fixture::{route, DiscoveryServer};
use super::resource_regressions::candidate;
use super::*;

#[tokio::test]
async fn resource_selection_is_sorted_bounded_and_preserves_http_evidence() {
    for delay in [None, Some(std::time::Duration::ZERO)] {
        let mut config = default_crawl_config(None);
        config.max_resource_requests = Some(2);
        config.max_concurrent_requests = Some(1);
        let server = DiscoveryServer::new(
            config,
            vec![
                route("/a", 200, "css"),
                route("/b", 404, "missing"),
                route("/z", 200, "unused"),
            ],
        )
        .await;
        let mut state = state();
        for path in ["/z", "/b", "/a"] {
            let url = server.url(path);
            state
                .resource_candidates
                .insert(url.clone(), candidate(url));
        }
        let (resources, limited) =
            crawl_secondary_resources(&server.setup, &CrawlControl::new(), &mut state, delay).await;
        assert!(limited);
        assert_eq!(
            resources.iter().map(|r| r.url.clone()).collect::<Vec<_>>(),
            vec![server.url("/a"), server.url("/b")]
        );
        assert_eq!(resources[0].http_status, Some(200));
        assert_eq!(resources[1].http_status, Some(404));
        assert_eq!(resources[0].source_urls, vec!["https://example.test/page"]);
        assert!(resources.iter().all(|r| r.request_error_kind.is_none()));
        assert!(state.resource_candidates.is_empty());
        assert_eq!(*server.requests.lock().unwrap(), vec!["/a", "/b"]);
        assert_eq!(state.last_page_request_at.is_some(), delay.is_some());
        assert!(!state.timed_out);
    }
}

#[tokio::test]
async fn zero_resource_budget_is_clamped_to_one_and_empty_state_is_safe() {
    let mut config = default_crawl_config(None);
    config.max_resource_requests = Some(0);
    config.max_concurrent_requests = Some(0);
    let server =
        DiscoveryServer::new(config, vec![route("/a", 200, "a"), route("/b", 200, "b")]).await;
    let mut state = state();
    let control = CrawlControl::new();
    let (resources, limited) =
        crawl_secondary_resources(&server.setup, &control, &mut state, None).await;
    assert!(resources.is_empty());
    assert!(!limited);
    for path in ["/a", "/b"] {
        let url = server.url(path);
        state
            .resource_candidates
            .insert(url.clone(), candidate(url));
    }
    let (resources, limited) =
        crawl_secondary_resources(&server.setup, &control, &mut state, None).await;
    assert!(limited);
    assert_eq!(resources.len(), 1);
    assert_eq!(resources[0].url, server.url("/a"));
    assert_eq!(*server.requests.lock().unwrap(), vec!["/a"]);
}

#[tokio::test]
async fn paused_phase_waits_before_fetch_and_resumes_with_same_candidates() {
    let server =
        DiscoveryServer::new(default_crawl_config(None), vec![route("/a", 200, "a")]).await;
    let control = CrawlControl::new();
    control.pause(&server.setup.run_id);
    let mut state = state();
    let url = server.url("/a");
    state
        .resource_candidates
        .insert(url.clone(), candidate(url));
    let future = crawl_secondary_resources(&server.setup, &control, &mut state, None);
    tokio::pin!(future);
    assert!(
        tokio::time::timeout(std::time::Duration::from_millis(30), &mut future)
            .await
            .is_err()
    );
    assert!(server.requests.lock().unwrap().is_empty());
    control.resume(&server.setup.run_id);
    let (resources, limited) = future.await;
    assert_eq!(resources.len(), 1);
    assert!(!limited);
    assert_eq!(resources[0].url, server.url("/a"));
}
