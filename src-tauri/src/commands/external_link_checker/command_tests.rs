use super::check_external_crawl_links;
use crate::utils::test_app::StorageApp;
use serde_json::Value;
use std::sync::{Arc, Mutex};
use tauri::Listener;

pub(super) fn fixture() -> StorageApp {
    StorageApp::new(
        tauri::test::mock_builder()
            .invoke_handler(tauri::generate_handler![check_external_crawl_links]),
    )
}

#[tokio::test]
async fn deduplicates_trimmed_rejections_and_emits_owned_progress() {
    let app = fixture();
    let events = Arc::new(Mutex::new(Vec::<Value>::new()));
    let received = events.clone();
    app.app
        .listen("crawl-external-link-progress", move |event| {
            received
                .lock()
                .unwrap()
                .push(serde_json::from_str(event.payload()).unwrap());
        });
    let targets = [
        " ",
        "ftp://b.test",
        " ftp://b.test ",
        "http://localhost/a",
        "http://localhost/a",
        "ftp://a.test",
    ];
    let batch = check_external_crawl_links(
        app.handle(),
        "owned".into(),
        targets.map(String::from).to_vec(),
        None,
    )
    .await
    .unwrap();
    assert_eq!((batch.requested, batch.checked, batch.omitted), (3, 3, 0));
    assert_eq!(
        batch
            .results
            .iter()
            .map(|r| r.url.as_str())
            .collect::<Vec<_>>(),
        ["ftp://a.test", "ftp://b.test", "http://localhost/a"]
    );
    for result in &batch.results {
        assert_eq!(result.http_status, None);
        assert_eq!(result.response_time_ms, None);
        assert_eq!(result.redirect_url, None);
        assert_eq!(
            result.request_error_kind.as_deref(),
            Some(if result.url.starts_with("ftp") {
                "invalid"
            } else {
                "blocked"
            })
        );
        assert!(chrono::DateTime::parse_from_rfc3339(&result.checked_at).is_ok());
    }
    let events = events.lock().unwrap();
    assert_eq!(events.len(), 3);
    for (index, event) in events.iter().enumerate() {
        assert_eq!(event["requestId"], "owned");
        assert_eq!(event["completed"], index + 1);
        assert_eq!(event["total"], 3);
        assert!(batch
            .results
            .iter()
            .any(|result| event["currentUrl"] == result.url));
        assert_eq!(event["httpStatus"], Value::Null);
        assert!(event["requestErrorKind"].is_string());
    }
}

#[tokio::test]
async fn clamps_zero_default_and_maximum_budgets_and_replenishes_workers() {
    let app = fixture();
    let targets = (0..1001)
        .map(|i| format!("ftp://target-{i}.test"))
        .collect::<Vec<_>>();
    for (limit, expected) in [(Some(0), 1), (None, 250), (Some(usize::MAX), 1000)] {
        let batch =
            check_external_crawl_links(app.handle(), "limits".into(), targets.clone(), limit)
                .await
                .unwrap();
        assert_eq!(
            (batch.requested, batch.checked, batch.omitted),
            (1001, expected, 1001 - expected)
        );
        assert_eq!(batch.results.len(), expected);
        assert!(batch
            .results
            .windows(2)
            .all(|pair| pair[0].url < pair[1].url));
        assert!(batch
            .results
            .iter()
            .all(|r| r.request_error_kind.as_deref() == Some("invalid")));
    }
}

#[tokio::test]
async fn enforces_input_cap_before_dedup_and_accepts_exact_boundary() {
    let app = fixture();
    let accepted = check_external_crawl_links(
        app.handle(),
        "cap".into(),
        vec!["ftp://same.test".into(); 20_000],
        None,
    )
    .await
    .unwrap();
    assert_eq!(
        (accepted.requested, accepted.checked, accepted.omitted),
        (1, 1, 0)
    );
    let error = check_external_crawl_links(
        app.handle(),
        "cap".into(),
        vec!["ftp://same.test".into(); 20_001],
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(
        error,
        "Too many external link targets were supplied (maximum input: 20,000)"
    );
    for targets in [vec![], vec!["".into(), "  ".into()]] {
        let empty = check_external_crawl_links(app.handle(), "empty".into(), targets, None)
            .await
            .unwrap();
        assert_eq!((empty.requested, empty.checked, empty.omitted), (0, 0, 0));
        assert!(empty.results.is_empty());
    }
}
