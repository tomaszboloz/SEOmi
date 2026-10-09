use super::normalize_request_id;
use super::rate_limiter::{
    AuditRateLimiter, AUDIT_MIN_INTERVAL_MS, AUDIT_RATE_LIMIT, AUDIT_RATE_WINDOW_MS,
};
use super::{control::AuditControl, AuditTransport};
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::{test::mock_builder, WebviewWindowBuilder};

#[test]
fn request_ids_are_bounded_and_have_a_fallback() {
    let fallback = normalize_request_id(None);
    assert!(!fallback.is_empty());
    assert!(normalize_request_id(Some("a".repeat(200))).chars().count() <= 128);
    assert!(!normalize_request_id(Some("bad\0id".into())).contains('\0'));
}

#[tokio::test]
async fn cancellation_notifies_an_active_request() {
    let control = AuditControl::new();
    let notify = control.register("request-1");
    let waiting = notify.notified();
    assert!(control.cancel("request-1"));
    tokio::time::timeout(std::time::Duration::from_millis(100), waiting)
        .await
        .expect("cancellation notification");
    control.finish("request-1");
    assert!(control.cancel("request-before-register"));
}

#[test]
fn rate_limiter_allows_ten_spaced_requests_and_rejects_the_eleventh() {
    let limiter = AuditRateLimiter::new();
    for index in 0..AUDIT_RATE_LIMIT {
        assert!(limiter.check(index as i64 * AUDIT_MIN_INTERVAL_MS).is_ok());
    }
    assert_eq!(
        limiter.check(AUDIT_RATE_LIMIT as i64 * AUDIT_MIN_INTERVAL_MS),
        Err("Audit rate limit reached. Try again in a minute.")
    );
}

#[test]
fn rate_limiter_rejects_a_request_before_the_minimum_interval() {
    let limiter = AuditRateLimiter::new();
    assert!(limiter.check(0).is_ok());
    assert_eq!(
        limiter.check(AUDIT_MIN_INTERVAL_MS - 1),
        Err("Audit requests are too frequent. Please wait a moment.")
    );
}

#[test]
fn rate_limiter_expires_old_entries_after_one_minute() {
    let limiter = AuditRateLimiter::new();
    for index in 0..AUDIT_RATE_LIMIT {
        assert!(limiter.check(index as i64 * AUDIT_MIN_INTERVAL_MS).is_ok());
    }
    assert!(limiter
        .check(AUDIT_RATE_WINDOW_MS + AUDIT_MIN_INTERVAL_MS)
        .is_ok());
}

#[tokio::test]
async fn headless_audit_rejects_local_targets_before_network_access() {
    let error = super::inspect_url_headless("http://127.0.0.1/private", None, 15)
        .await
        .unwrap_err();
    assert!(error.starts_with("URL validation failed:"));
}

#[test]
fn audit_ipc_rejects_invalid_targets_and_tracks_pre_start_cancellation() {
    let app = StorageApp::new(
        mock_builder()
            .manage(AuditControl::new())
            .manage(AuditRateLimiter::new())
            .manage(AuditTransport::production())
            .invoke_handler(tauri::generate_handler![
                super::inspect_url,
                super::cancel_inspect_url
            ]),
    );
    let view = WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap();
    let error = invoke(
        &view,
        "inspect_url",
        json!({"url":"http://127.0.0.1/private"}),
    )
    .unwrap_err();
    assert!(error.to_string().contains("URL validation failed"));
    assert_eq!(
        invoke(
            &view,
            "cancel_inspect_url",
            json!({"requestId":"before-start"}),
        )
        .unwrap(),
        true
    );
}
