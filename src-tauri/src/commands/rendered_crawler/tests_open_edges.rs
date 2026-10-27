use super::{
    models::{RenderOptions, CAPTURE_SCHEME},
    navigation::{parse_capture_chunk, parse_transfer_failed},
    session::RenderedCrawlerSession,
};
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;
use url::Url;

#[tokio::test]
async fn session_open_with_extensive_render_options() {
    let app = StorageApp::new(mock_builder());
    let options = RenderOptions {
        user_agent: Some("CustomBot/3.0".into()),
        cookie: Some("session_id=12345; secure".into()),
        wait_for_selector: Some("#main-content".into()),
        wait_delay_ms: 1_200,
        lazy_scroll_cycles: 6,
        allowed_hosts: vec!["cdn.example.test".into(), "assets.example.test".into()],
    };
    let session = RenderedCrawlerSession::open(
        &app.handle(),
        "https://example.test/portal",
        "example.test",
        true,
        Some("/portal"),
        options,
    )
    .await
    .unwrap();

    assert_eq!(session.base_host, "example.test");
    assert!(session.allow_subdomains);
    assert_eq!(session.scope_path.as_deref(), Some("/portal"));
    assert_eq!(session.allowed_hosts.len(), 2);
    assert_eq!(session.requested_url, "https://example.test/portal");
    assert!(session.initial_load_pending);
    session.close();
}

#[tokio::test]
async fn session_open_rejects_unsafe_and_malformed_urls() {
    let app = StorageApp::new(mock_builder());
    for bad_url in [
        "file:///etc/hosts",
        "http://192.168.1.1/",
        "http://10.0.0.1/",
        "http://127.0.0.1:8080/",
        "javascript:alert(1)",
        "data:text/html,bad",
        "http://user:pass@example.test/",
        "http://printer.local/",
        "",
    ] {
        let res = RenderedCrawlerSession::open(
            &app.handle(),
            bad_url,
            "example.test",
            false,
            None,
            Default::default(),
        )
        .await;
        assert!(res.is_err(), "expected error for {bad_url}");
    }
}

#[test]
fn capture_navigation_error_url_pattern_parsing() {
    let nonce = "test-error-nonce-123";
    let valid_error_url = Url::parse(&format!("{CAPTURE_SCHEME}://{nonce}/42/error")).unwrap();
    assert_eq!(parse_transfer_failed(&valid_error_url, nonce), Some(42));

    let zero_seq = Url::parse(&format!("{CAPTURE_SCHEME}://{nonce}/0/error")).unwrap();
    assert_eq!(parse_transfer_failed(&zero_seq, nonce), Some(0));

    let non_numeric = Url::parse(&format!("{CAPTURE_SCHEME}://{nonce}/invalid/error")).unwrap();
    assert_eq!(parse_transfer_failed(&non_numeric, nonce), None);

    let wrong_suffix = Url::parse(&format!("{CAPTURE_SCHEME}://{nonce}/42/done")).unwrap();
    assert_eq!(parse_transfer_failed(&wrong_suffix, nonce), None);

    let empty_path = Url::parse(&format!("{CAPTURE_SCHEME}://{nonce}")).unwrap();
    assert_eq!(parse_transfer_failed(&empty_path, nonce), None);

    let wrong_scheme = Url::parse(&format!("https://{nonce}/42/error")).unwrap();
    assert_eq!(parse_transfer_failed(&wrong_scheme, nonce), None);

    let wrong_nonce = Url::parse(&format!("{CAPTURE_SCHEME}://other/42/error")).unwrap();
    assert_eq!(parse_transfer_failed(&wrong_nonce, nonce), None);

    let extra_path = Url::parse(&format!("{CAPTURE_SCHEME}://{nonce}/42/extra/error")).unwrap();
    assert_eq!(parse_transfer_failed(&extra_path, nonce), None);
}

#[test]
fn parse_capture_chunk_validates_scheme_and_parameters() {
    let nonce = "chunk-test-nonce";
    let chunk_url = Url::parse(&format!(
        "{CAPTURE_SCHEME}://{nonce}/5/1/4?data=payload_data"
    ))
    .unwrap();
    let chunk = parse_capture_chunk(&chunk_url, nonce).unwrap();
    assert_eq!(chunk.sequence, 5);
    assert_eq!(chunk.index, 1);
    assert_eq!(chunk.total, 4);
    assert_eq!(chunk.data, "payload_data");

    // Mismatched nonce
    assert!(parse_capture_chunk(&chunk_url, "different-nonce").is_none());

    // Out of bounds index
    let bad_index = Url::parse(&format!("{CAPTURE_SCHEME}://{nonce}/5/4/4?data=payload")).unwrap();
    assert!(parse_capture_chunk(&bad_index, nonce).is_none());
}
