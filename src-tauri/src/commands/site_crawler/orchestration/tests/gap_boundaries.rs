use super::super::{
    loop_runner::run_crawl_loop, page_assembler::assemble_page_summary,
    robots_scope::robots_allowed_hosts,
};
use super::discovery_http_fixture::{html_route, DiscoveryServer};
use super::loop_runner_coverage::empty_state;
use super::page_fixture::*;
use super::setup_config::default_crawl_config;
use super::*;
use crate::commands::site_crawler::fetch_types::{FetchedPageBody, FetchedResponse};
use crate::utils::test_app::StorageApp;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{test::mock_builder, Listener};
#[test]
fn robots_scope_preserves_hosts_without_a_base_host_and_deduplicates_aliases() {
    let mut hostless = setup(default_crawl_config(None));
    hostless.config.allowed_hosts = vec!["configured.example".into()];
    hostless.parsed_base = url::Url::parse("file:///robots.txt").unwrap();
    assert_eq!(robots_allowed_hosts(&hostless), vec!["configured.example"]);

    let mut www = setup(default_crawl_config(None));
    www.config.allowed_hosts = vec!["example.test".into()];
    www.parsed_base = url::Url::parse("https://www.example.test/").unwrap();
    assert_eq!(robots_allowed_hosts(&www), vec!["example.test"]);
}
#[tokio::test]
async fn assembler_marks_non_html_body_without_extracting_html_evidence() {
    let mut page_data = data("raw");
    page_data.declared_html = false;
    page_data.content_type = Some("image/png".into());
    page_data.body = vec![0, 159, 146, 150];
    let fetched = FetchedResponse {
        response: FetchedPageBody::Prefetched(Box::new(page_data)),
        final_url: FINAL_URL.into(),
        redirect_chain: Vec::new(),
        redirect_stopped_reason: None,
        request_duration_ms: None,
        retry_count: 0,
    };
    let mut state = empty_state();
    assemble_page_summary(
        fetched,
        9,
        CURRENT_URL,
        1,
        &CrawlSelectors::compile(),
        &setup(default_crawl_config(None)),
        &mut state,
    )
    .await
    .unwrap();
    let page = &state.pages[0];
    assert_eq!(page.content_type.as_deref(), Some("image/png"));
    assert_eq!(page.word_count, 0);
    assert!(page.title.is_none());
    assert!(page
        .issues
        .iter()
        .any(|issue| issue.message == "Non-HTML resource: HTML SEO checks were skipped"));
}
#[tokio::test]
async fn loop_reports_zero_rate_and_stops_on_delay_cancellation() {
    let mut server = DiscoveryServer::new(
        default_crawl_config(Some(1)),
        vec![html_route("/", "<html><body>root</body></html>")],
    )
    .await;
    let app = StorageApp::new(mock_builder());
    let root_url = server.url("/");
    let events = Arc::new(Mutex::new(Vec::<Value>::new()));
    let received = events.clone();
    app.app.listen("crawl-progress", move |event| {
        received
            .lock()
            .unwrap()
            .push(serde_json::from_str(event.payload()).unwrap());
    });
    server.setup.start_time = Instant::now() + Duration::from_secs(1);
    let mut zero_rate_state = empty_state();
    zero_rate_state.queue.push_back((root_url.clone(), 0));
    run_crawl_loop(
        &app.handle(),
        &CrawlControl::new(),
        &server.setup,
        &mut zero_rate_state,
        &CrawlSelectors::compile(),
        &[],
        None,
    )
    .await;
    assert_eq!(events.lock().unwrap()[0]["pagesPerSecond"], 0.0);
    server.requests.lock().unwrap().clear();
    server.setup.start_time = Instant::now();
    let control = Arc::new(CrawlControl::new());
    let cancel_control = control.clone();
    let run_id = server.setup.run_id.clone();
    let canceller = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(20)).await;
        cancel_control.cancelled_runs.lock().unwrap().insert(run_id);
    });
    let mut state = empty_state();
    state.last_page_request_at = Some(Instant::now());
    state.queue.push_back((root_url, 0));
    run_crawl_loop(
        &app.handle(),
        &control,
        &server.setup,
        &mut state,
        &CrawlSelectors::compile(),
        &[],
        Some(Duration::from_secs(5)),
    )
    .await;
    canceller.await.unwrap();
    assert!(state.pages.is_empty());
    assert!(server.requests.lock().unwrap().is_empty());
}

#[test]
fn throughput_is_zero_until_time_has_elapsed() {
    use super::super::summary::pages_per_second;
    assert_eq!(pages_per_second(5, 0.0), 0.0);
    assert_eq!(pages_per_second(5, 2.0), 2.5);
}
