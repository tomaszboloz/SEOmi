use super::super::robots_evaluation::{error_message, evaluate_response, response_status};
use super::page_fixture::data;
use super::*;
use crate::commands::site_crawler::{fetch_types::FetchedPageBody, retry::RetryError};

#[tokio::test]
async fn non_http_robots_responses_are_unknown_without_a_status() {
    let body = FetchedPageBody::Prefetched(Box::new(data("User-agent: *")));
    assert_eq!(response_status(&body), None);
    let setup = setup(default_crawl_config(None));
    let evaluation = evaluate_response(
        body,
        &setup,
        Some("https://example.test/robots.txt".into()),
        Vec::new(),
    )
    .await;
    assert_eq!(evaluation.status_code, None);
    assert!(evaluation.status.contains("robots response was not HTTP"));
    assert!(evaluation.rules.is_empty());
}

#[test]
fn retry_errors_become_operator_messages() {
    assert_eq!(
        error_message(RetryError::Deadline),
        "crawl deadline reached"
    );
    let error = reqwest::Client::new().get("not a url").build().unwrap_err();
    assert_eq!(
        error_message(RetryError::Request(error)),
        reqwest::Client::new()
            .get("not a url")
            .build()
            .unwrap_err()
            .to_string()
    );
}
