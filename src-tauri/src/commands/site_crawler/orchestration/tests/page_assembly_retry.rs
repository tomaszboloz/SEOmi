use super::super::super::fetch_types::{FetchedPageBody, FetchedResponse};
use super::super::page_assembler::assemble_page_summary;
use super::page_fixture::*;
use super::*;

#[tokio::test]
async fn final_transient_status_keeps_critical_issue_after_retry() {
    let mut page_data = data(HTML);
    page_data.status = 503;
    let fetched = FetchedResponse {
        response: FetchedPageBody::Prefetched(Box::new(page_data)),
        final_url: FINAL_URL.into(),
        redirect_chain: vec![hop()],
        redirect_stopped_reason: None,
        request_duration_ms: None,
        retry_count: 1,
    };
    let mut state = state();
    assemble_page_summary(
        fetched,
        12,
        CURRENT_URL,
        0,
        &CrawlSelectors::compile(),
        &setup(default_crawl_config(None)),
        &mut state,
    )
    .await
    .unwrap();
    let issues = &state.pages[0].issues;
    assert!(issues
        .iter()
        .any(|issue| { issue.severity == "Critical" && issue.message == "HTTP error status 503" }));
    assert!(!issues
        .iter()
        .any(|issue| issue.message.contains("recovered after")));
}
