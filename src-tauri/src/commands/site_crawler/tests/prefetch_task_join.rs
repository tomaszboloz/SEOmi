use crate::commands::site_crawler::fetch_types::{
    FetchedPageBody, FetchedPageData, FetchedResponse,
};
use crate::commands::site_crawler::prefetch::{absorb_joined, read_http_body};
use crate::commands::site_crawler::retry::RetryContext;
use std::collections::{HashMap, VecDeque};

fn prefetched(url: &str) -> FetchedResponse {
    let data = FetchedPageData {
        status: 200,
        http_response_url: None,
        response_url_mismatch: false,
        content_type: None,
        content_disposition: None,
        content_length: None,
        content_encoding: None,
        http_refresh: None,
        cache_control: None,
        charset: None,
        x_robots_tag: None,
        declared_html: true,
        body_truncated: false,
        body_read_failed: false,
        body: b"ok".to_vec(),
        rendered_diagnostics: None,
        browser_navigation_time_ms: None,
        rendered_lcp_ms: None,
        rendered_inp_ms: None,
        rendered_cls: None,
        response_headers_available: true,
        render_fallback: None,
    };
    FetchedResponse {
        response: FetchedPageBody::Prefetched(Box::new(data)),
        final_url: url.into(),
        redirect_chain: Vec::new(),
        redirect_stopped_reason: None,
        request_duration_ms: None,
        retry_count: 0,
    }
}

#[tokio::test]
async fn joined_results_are_stored_and_panicked_tasks_fail_the_queued_page() {
    let order: VecDeque<_> = [("https://a.test/".to_string(), 0)].into();
    let mut responses = HashMap::new();
    let mut tasks = tokio::task::JoinSet::new();
    tasks.spawn(async {
        (
            "https://ok.test/".to_string(),
            Ok(prefetched("https://ok.test/")),
        )
    });
    absorb_joined(tasks.join_next().await.unwrap(), &order, &mut responses);
    assert!(matches!(responses.get("https://ok.test/"), Some(Ok(_))));
    tasks.spawn(async {
        if true {
            panic!("boom");
        }
        ("never".to_string(), Ok(prefetched("never")))
    });
    absorb_joined(tasks.join_next().await.unwrap(), &order, &mut responses);
    assert!(matches!(
        responses.get("https://a.test/"),
        Some(Err(failure)) if failure.kind == "prefetch_task" && failure.message.contains("panic")
    ));
}

#[tokio::test]
async fn bodies_that_are_already_read_pass_through_unchanged() {
    let context = RetryContext::disabled();
    let fetched = read_http_body(prefetched("https://done.test/"), 10, &context).await;
    assert_eq!(fetched.final_url, "https://done.test/");
    assert!(matches!(
        fetched.response,
        FetchedPageBody::Prefetched(data) if data.body == b"ok"
    ));
}
