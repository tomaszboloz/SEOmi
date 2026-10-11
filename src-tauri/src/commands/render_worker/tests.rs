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

#[test]
fn render_request_prepares_normalized_inputs_without_opening_renderer() {
    use super::render::prepare_render_request;

    assert!(prepare_render_request(RenderWorkerRequest {
        url: "https://[".into(),
        allow_subdomains: false,
        scope_path: None,
        wait_for_selector: None,
        wait_delay_ms: 0,
        lazy_scroll_cycles: 0,
    })
    .is_err());

    assert!(prepare_render_request(RenderWorkerRequest {
        url: "https://example.test/".into(),
        allow_subdomains: false,
        scope_path: Some("not-rooted".into()),
        wait_for_selector: None,
        wait_delay_ms: 0,
        lazy_scroll_cycles: 0,
    })
    .is_err());

    assert!(prepare_render_request(RenderWorkerRequest {
        url: "https://example.test/".into(),
        allow_subdomains: false,
        scope_path: None,
        wait_for_selector: Some("h1\0null".into()),
        wait_delay_ms: 0,
        lazy_scroll_cycles: 0,
    })
    .is_err());

    let prepared = prepare_render_request(RenderWorkerRequest {
        url: "https://example.test/".into(),
        allow_subdomains: true,
        scope_path: Some("/docs".into()),
        wait_for_selector: Some("h1".into()),
        wait_delay_ms: 10,
        lazy_scroll_cycles: 1,
    })
    .unwrap();
    assert_eq!(prepared.target.as_str(), "https://example.test/");
    assert_eq!(prepared.base_host, "example.test");
    assert_eq!(prepared.scope_path.as_deref(), Some("/docs"));
    assert_eq!(prepared.options.wait_for_selector.as_deref(), Some("h1"));
    assert_eq!(prepared.options.wait_delay_ms, 10);
    assert_eq!(prepared.options.lazy_scroll_cycles, 1);
}

#[test]
fn format_render_snapshot_serializes_and_enforces_safety_limit() {
    use super::server::format_render_snapshot;
    use crate::commands::rendered_crawler::RenderedPageSnapshot;

    let snapshot = RenderedPageSnapshot {
        requested_url: "https://example.test".into(),
        final_url: "https://example.test".into(),
        http_status: Some(200),
        content_type: "text/html".into(),
        charset: "utf-8".into(),
        html: "<html></html>".into(),
        html_truncated: false,
        navigation_time_ms: Some(10),
        lcp_ms: None,
        inp_ms: None,
        cls: None,
        failed_resource_urls: vec![],
        console_errors: vec![],
    };
    let (status, ct, body) = format_render_snapshot(&snapshot).unwrap();
    assert_eq!(status, 200);
    assert_eq!(ct, "application/json");
    assert!(!body.is_empty());

    let giant_snapshot = RenderedPageSnapshot {
        html: "x".repeat(9 * 1024 * 1024),
        ..snapshot
    };
    let (status, ct, body) = format_render_snapshot(&giant_snapshot).unwrap();
    assert_eq!(status, 413);
    assert_eq!(ct, "application/json");
    assert!(String::from_utf8_lossy(&body).contains("exceeds the response safety limit"));
}
