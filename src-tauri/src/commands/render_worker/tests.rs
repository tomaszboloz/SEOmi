use super::http::bearer_matches;
use super::models::{RenderWorkerRequest, MAX_BODY_BYTES, RENDER_WORKER_VERSION, WORKER_TTL};
use super::render::{normalize_bounded_text, normalize_scope_path};
use std::{sync::Arc, time::Duration};
use tokio::sync::Mutex;

#[test]
fn scope_path_requires_a_rooted_path_and_is_trimmed() {
    assert_eq!(
        normalize_scope_path(Some(" /docs/ ")).unwrap(),
        Some("/docs".into())
    );
    assert!(normalize_scope_path(Some("docs")).is_err());
    assert!(normalize_scope_path(Some("/docs\0evil")).is_err());
}

#[test]
fn bounded_worker_text_rejects_empty_long_and_null_values() {
    assert!(normalize_bounded_text(" ", "selector", 10).is_err());
    assert!(normalize_bounded_text("123456", "selector", 5).is_err());
    assert!(normalize_bounded_text("ok\0", "selector", 10).is_err());
    assert_eq!(
        normalize_bounded_text(" h1 ", "selector", 10).unwrap(),
        "h1"
    );
}

#[test]
fn worker_protocol_is_explicit_and_short_lived() {
    assert_eq!(RENDER_WORKER_VERSION, "1");
    assert!(WORKER_TTL <= Duration::from_secs(120));
    assert_eq!(MAX_BODY_BYTES, 64 * 1024);
}

#[test]
fn render_request_schema_does_not_accept_transport_hooks() {
    let error = serde_json::from_str::<RenderWorkerRequest>(
        r#"{"url":"https://example.test","proxy":"http://127.0.0.1"}"#,
    )
    .unwrap_err();
    assert!(error.to_string().contains("unknown field"));
}

#[tokio::test]
async fn bearer_token_is_consumed_after_the_first_valid_request() {
    let token = Arc::new(Mutex::new(Some("one-shot".to_string())));
    assert!(bearer_matches(Some("Bearer one-shot"), &token).await);
    assert!(!bearer_matches(Some("Bearer one-shot"), &token).await);
    assert!(!bearer_matches(Some("Bearer other"), &token).await);
}
