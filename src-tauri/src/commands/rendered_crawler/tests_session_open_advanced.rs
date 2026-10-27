use super::{
    models::{CaptureEvent, RenderOptions},
    session_open::capture_event_for_navigation,
    session_open_prepare::prepare_session_open,
};
use url::Url;

#[test]
fn capture_event_handles_malformed_and_boundary_urls() {
    let nonce = "test-session-nonce";
    for invalid in [
        "https://example.test/path",
        "http://seomi.test/capture",
        "seomi-capture://wrong-nonce/1/0/1?data=val",
        "seomi-capture://test-session-nonce/",
        "seomi-capture://test-session-nonce/abc/0/1?data=val",
        "seomi-capture://test-session-nonce/1/abc/1?data=val",
        "seomi-capture://test-session-nonce/1/0/abc?data=val",
        "seomi-capture://test-session-nonce/1/0/0?data=val",
        "seomi-capture://test-session-nonce/1/2/1?data=val",
        "seomi-capture://test-session-nonce/1/0/1",
        "seomi-capture://test-session-nonce/error",
        "seomi-capture://test-session-nonce/notanumber/error",
        "seomi-capture://test-session-nonce/1/other",
    ] {
        let url = Url::parse(invalid).unwrap();
        assert!(
            capture_event_for_navigation(&url, nonce).is_none(),
            "expected None for {invalid}"
        );
    }

    let success_chunk =
        Url::parse(&format!("seomi-capture://{nonce}/12/3/4?data=payload123")).unwrap();
    match capture_event_for_navigation(&success_chunk, nonce) {
        Some(CaptureEvent::Chunk(chunk)) => {
            assert_eq!(chunk.sequence, 12);
            assert_eq!(chunk.index, 3);
            assert_eq!(chunk.total, 4);
            assert_eq!(chunk.data, "payload123");
        }
        other => panic!("expected Chunk, got {other:?}"),
    }

    let fail_url = Url::parse(&format!("seomi-capture://{nonce}/99/error")).unwrap();
    assert!(matches!(
        capture_event_for_navigation(&fail_url, nonce),
        Some(CaptureEvent::TransferFailed(99))
    ));
}

#[test]
fn session_open_rejects_ssrf_and_invalid_urls_before_renderer_start() {
    for bad_url in [
        "",
        "   ",
        "ftp://example.test/resource",
        "http://127.0.0.1:8080/admin",
        "http://192.168.0.1/router",
        "http://localhost:3000/app",
        "http://gateway.local/status",
        "http://",
        "https://admin:secret@example.test/",
    ] {
        let result = prepare_session_open(
            bad_url,
            "example.test",
            false,
            None,
            RenderOptions::default(),
        );
        assert!(result.is_err(), "expected error for {bad_url}");
    }
}

#[test]
fn session_open_prepares_session_properties_without_renderer_or_network() {
    let options = RenderOptions {
        user_agent: Some("CustomSEO/3.0".into()),
        cookie: Some("auth_token=secret123".into()),
        wait_for_selector: Some("main#content".into()),
        wait_delay_ms: 250,
        lazy_scroll_cycles: 2,
        allowed_hosts: vec!["cdn.example.test".into(), "assets.example.test".into()],
    };
    let prepared = prepare_session_open(
        "https://example.test/catalog",
        "EXAMPLE.TEST",
        true,
        Some("/catalog"),
        options,
    )
    .unwrap();

    assert_eq!(prepared.start_url.as_str(), "https://example.test/catalog");
    assert_eq!(prepared.base_host, "example.test");
    assert!(prepared.allow_subdomains);
    assert_eq!(prepared.scope_path.as_deref(), Some("/catalog"));
    assert_eq!(
        prepared.options.allowed_hosts,
        vec!["cdn.example.test", "assets.example.test"]
    );
    assert_eq!(
        prepared.options.user_agent.as_deref(),
        Some("CustomSEO/3.0")
    );
    assert_eq!(
        prepared.options.cookie.as_deref(),
        Some("auth_token=secret123")
    );
    assert_eq!(
        prepared.options.wait_for_selector.as_deref(),
        Some("main#content")
    );
    assert_eq!(prepared.options.wait_delay_ms, 250);
    assert_eq!(prepared.options.lazy_scroll_cycles, 2);
}
