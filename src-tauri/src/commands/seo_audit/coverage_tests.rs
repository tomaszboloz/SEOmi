use super::{
    inspect_url, inspect_url_headless, normalize_request_id, AuditControl, AuditRateLimiter,
    AuditTransport,
};
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::{test::mock_builder, WebviewWindowBuilder};

#[tokio::test]
async fn inspect_url_reports_transport_network_error() {
    let transport = AuditTransport::with_resolver(|_| async {
        Err(anyhow::anyhow!("simulated connection reset"))
    });
    let app = StorageApp::new(
        mock_builder()
            .manage(AuditControl::new())
            .manage(AuditRateLimiter::new())
            .manage(transport)
            .invoke_handler(tauri::generate_handler![
                inspect_url,
                super::cancel_inspect_url
            ]),
    );
    let view = WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap();
    let err = invoke(
        &view,
        "inspect_url",
        json!({
            "url": "https://example.com/fail",
            "userAgent": "TestAgent/1.0",
            "timeoutSecs": 5,
            "maxRedirects": 3,
            "verifySsl": false,
            "requestId": "custom-req-id"
        }),
    )
    .unwrap_err();
    assert!(err
        .to_string()
        .contains("Network request failed: simulated connection reset"));
}

#[tokio::test]
async fn inspect_url_headless_executes_fetch_path() {
    let err = inspect_url_headless("https://example.invalid", Some("Headless/1.0"), 100)
        .await
        .unwrap_err();
    assert!(!err.is_empty());

    let err_default_ua = inspect_url_headless("https://example.invalid", None, 1)
        .await
        .unwrap_err();
    assert!(!err_default_ua.is_empty());
}

#[test]
fn normalize_request_id_handles_empty_trimmed_string() {
    let result = normalize_request_id(Some("   ".into()));
    assert!(!result.is_empty());
    assert!(!result.contains(' '));
}
