use super::*;
use crate::commands::external_link_checker::concurrency::new_host_gates;

fn ok(url: String) -> ExternalLinkCheck {
    ExternalLinkCheck {
        url,
        http_status: Some(200),
        response_time_ms: None,
        redirect_url: None,
        request_error_kind: None,
        checked_at: String::new(),
    }
}

#[tokio::test]
async fn every_url_is_checked_and_progress_counts_up() {
    let urls: Vec<String> = (0..MAX_CONCURRENT_EXTERNAL_LINKS + 3)
        .map(|index| format!("https://example.com/{index}"))
        .collect();
    let mut counts = Vec::new();
    let results = run_checks(
        urls.clone(),
        new_host_gates(),
        |url, _| async move { ok(url) },
        |done, _| counts.push(done),
    )
    .await
    .unwrap();
    assert_eq!(results.len(), urls.len());
    assert_eq!(counts, (1..=urls.len()).collect::<Vec<_>>());
}

#[tokio::test]
async fn a_panicking_check_fails_the_whole_batch() {
    let error = run_checks(
        vec!["https://example.com/".into()],
        new_host_gates(),
        |url, _| async move {
            if url.starts_with("https") {
                panic!("check crashed");
            }
            ok(url)
        },
        |_, _| {},
    )
    .await
    .unwrap_err();
    assert_eq!(error, "An external link check task failed unexpectedly");
}
