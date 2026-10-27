use super::super::page_prefetch::prefetch_parallelism;
use super::super::rendered_prefetch::prefetch_rendered_pages;
use super::discovery_http_fixture::{media_route, DiscoveryServer};
use super::*;
use crate::commands::site_crawler::fetch_types::FetchedPageBody;
use crate::utils::test_app::StorageApp;
use std::time::Duration;
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

#[test]
fn render_prefetch_parallelism_respects_browser_cap_and_delay() {
    let mut config = default_crawl_config(None);
    config.crawl_mode = "browser-rendered".into();
    config.max_concurrent_requests = Some(64);
    assert_eq!(prefetch_parallelism(&config, None), 6);
    assert_eq!(prefetch_parallelism(&config, Some(Duration::ZERO)), 1);
}

#[tokio::test]
async fn rendered_prefetch_reads_media_without_opening_a_browser() {
    let mut config = default_crawl_config(Some(3));
    config.crawl_mode = "browser-rendered".into();
    config.max_concurrent_requests = Some(3);
    let server = DiscoveryServer::new(
        config,
        vec![
            media_route("/one", "one"),
            media_route("/two", "two"),
            media_route("/three", "three"),
        ],
    )
    .await;
    let urls = [server.url("/one"), server.url("/two"), server.url("/three")];
    let mut state = queued_state(&urls);
    let app = StorageApp::new(mock_builder());
    prefetch_rendered_pages(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut state,
        3,
        &[],
    )
    .await;

    assert_eq!(state.prefetched_order.len(), 3);
    assert_eq!(state.prefetched_responses.len(), 3);
    for url in urls {
        let fetched = state.prefetched_responses.remove(&url).unwrap().unwrap();
        let FetchedPageBody::Prefetched(data) = fetched.response else {
            panic!("media prefetch should be fully read before rendering");
        };
        assert!(!data.declared_html);
        assert!(data.body.is_empty());
        assert_eq!(data.status, 200);
    }
    assert_eq!(server.requests.lock().unwrap().len(), 3);
}
