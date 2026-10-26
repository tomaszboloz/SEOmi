use std::collections::HashMap;
use tauri::test::MockRuntime;

use super::super::rendered_prefetch_failure::handle_joined_prefetch_task;
use super::super::state::CrawlLoopState;
use crate::commands::site_crawler::fetch_types::{
    CrawlFetchFailure, FetchedPageBody, FetchedPageData, FetchedResponse,
};

fn queued_state() -> CrawlLoopState<MockRuntime> {
    CrawlLoopState::new(
        Default::default(),
        Default::default(),
        Vec::new(),
        Default::default(),
        false,
        false,
    )
}

fn test_page_data() -> FetchedPageData {
    FetchedPageData {
        status: 200,
        http_response_url: Some("https://example.test/ok".into()),
        response_url_mismatch: false,
        content_type: Some("text/html".into()),
        content_disposition: None,
        content_length: Some(13),
        content_encoding: None,
        http_refresh: None,
        cache_control: None,
        last_modified: None,
        charset: Some("utf-8".into()),
        x_robots_tag: None,
        declared_html: true,
        body_truncated: false,
        body_read_failed: false,
        body: b"<html></html>".to_vec(),
        rendered_diagnostics: None,
        browser_navigation_time_ms: None,
        rendered_lcp_ms: None,
        rendered_inp_ms: None,
        rendered_cls: None,
        response_headers_available: true,
        render_fallback: None,
    }
}

#[tokio::test]
async fn handle_joined_task_skips_cancelled_tasks_without_attributing_error() {
    let mut tasks = tokio::task::JoinSet::new();
    let handle = tasks.spawn(async {
        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
        (
            "https://example.test/cancelled".to_string(),
            None,
            Err(CrawlFetchFailure {
                kind: "test".into(),
                message: "cancelled".into(),
            }),
        )
    });
    let mut urls = HashMap::new();
    urls.insert(handle.id(), "https://example.test/cancelled".to_string());
    handle.abort();

    let joined = tasks.join_next().await.unwrap();
    assert!(matches!(joined, Err(ref e) if e.is_cancelled()));

    let mut state = queued_state();
    handle_joined_prefetch_task(&mut state, &mut urls, joined);

    assert!(state.prefetched_responses.is_empty());
    assert_eq!(
        urls.len(),
        1,
        "cancelled task does not consume from task_urls"
    );
}

#[tokio::test]
async fn handle_joined_task_records_panicked_task_failure() {
    let mut tasks = tokio::task::JoinSet::new();
    let handle = tasks.spawn(async {
        panic!("webview exploded");
        #[allow(unreachable_code)]
        (
            "https://example.test/panicked".to_string(),
            None,
            Err(CrawlFetchFailure {
                kind: "test".into(),
                message: "panic".into(),
            }),
        )
    });
    let mut urls = HashMap::new();
    urls.insert(handle.id(), "https://example.test/panicked".to_string());

    let joined = tasks.join_next().await.unwrap();
    assert!(matches!(joined, Err(ref e) if e.is_panic()));

    let mut state = queued_state();
    handle_joined_prefetch_task(&mut state, &mut urls, joined);

    assert!(urls.is_empty(), "failure consumes the url mapping");
    match &state.prefetched_responses["https://example.test/panicked"] {
        Err(failure) => {
            assert_eq!(failure.kind, "prefetch_task");
            assert!(
                failure.message.contains("webview exploded") || failure.message.contains("panic")
            );
        }
        Ok(_) => panic!("expected failure recorded in prefetched_responses"),
    }
}

#[test]
fn handle_joined_task_records_successful_result_and_session() {
    let mut urls = HashMap::new();
    let mut state = queued_state();

    let fetched = FetchedResponse {
        response: FetchedPageBody::Prefetched(Box::new(test_page_data())),
        final_url: "https://example.test/ok".into(),
        redirect_chain: Vec::new(),
        redirect_stopped_reason: None,
        request_duration_ms: Some(10),
        retry_count: 0,
    };

    handle_joined_prefetch_task(
        &mut state,
        &mut urls,
        Ok(("https://example.test/ok".into(), None, Ok(fetched))),
    );

    assert_eq!(state.prefetched_responses.len(), 1);
    match &state.prefetched_responses["https://example.test/ok"] {
        Ok(outcome) => assert_eq!(outcome.final_url, "https://example.test/ok"),
        Err(e) => panic!("expected successful response, got {:?}", e),
    }
}
