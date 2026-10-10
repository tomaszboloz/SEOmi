use super::{
    models::{CaptureChunk, CaptureEvent},
    session::RenderedCrawlerSession,
};
use crate::utils::test_app::StorageApp;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use tauri::{
    test::{mock_builder, MockRuntime},
    WebviewWindowBuilder,
};
use tokio::sync::mpsc;

fn fixture(
    initial_load_pending: bool,
    requested_url: &str,
) -> (
    StorageApp,
    RenderedCrawlerSession<MockRuntime>,
    mpsc::Sender<CaptureEvent>,
) {
    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(
        &app.app,
        format!("test-{}", uuid::Uuid::new_v4().simple()),
        Default::default(),
    )
    .build()
    .unwrap();
    let (sender, receiver) = mpsc::channel(16);
    let session = RenderedCrawlerSession {
        window,
        proxy: None,
        receiver,
        nonce: "test-nonce".into(),
        requested_url: requested_url.into(),
        initial_load_pending,
        base_host: "example.test".into(),
        allow_subdomains: false,
        scope_path: Some("/section".into()),
        allowed_hosts: Vec::new(),
    };
    (app, session, sender)
}

fn valid_payload() -> String {
    URL_SAFE_NO_PAD.encode(
        br#"{"page_url":"https://example.test/section/page","http_status":200,"content_type":"text/html","charset":"utf-8","html":"ok","html_truncated":false,"navigation_time_ms":10,"lcp_ms":20,"inp_ms":1,"cls":0.0,"failed_resource_urls":[],"console_errors":[]}"#,
    )
}

#[tokio::test]
async fn capture_rejects_out_of_scope_and_invalid_urls() {
    let (_app, mut session, _tx) = fixture(true, "https://example.test/section/page");
    assert!(session.capture("bad url").await.is_err());
    let error = session.capture("https://other.test/").await.unwrap_err();
    assert_eq!(
        error,
        "The rendered URL is outside the configured crawl scope."
    );
    let out_of_path = session
        .capture("https://example.test/other")
        .await
        .unwrap_err();
    assert_eq!(
        out_of_path,
        "The rendered URL is outside the configured crawl scope."
    );
}

#[tokio::test]
async fn capture_renavigation_drains_stale_events_and_captures() {
    let (_app, mut session, sender) = fixture(false, "https://example.test/section/page");
    sender.try_send(CaptureEvent::TransferFailed(999)).unwrap();
    tokio::spawn(async move {
        tokio::task::yield_now().await;
        let _ = sender.send(CaptureEvent::PageReady(1)).await;
        let payload = valid_payload();
        let _ = sender
            .send(CaptureEvent::Chunk(CaptureChunk {
                sequence: 1,
                index: 0,
                total: 1,
                data: payload,
            }))
            .await;
    });
    let snapshot = session
        .capture("https://example.test/section/page")
        .await
        .unwrap();
    assert_eq!(snapshot.final_url, "https://example.test/section/page");
}

#[tokio::test]
async fn capture_ignores_extraneous_events_in_both_loops() {
    let (_app, mut session, sender) = fixture(true, "https://example.test/section/page");
    sender.try_send(CaptureEvent::TransferFailed(0)).unwrap();
    sender.try_send(CaptureEvent::PageReady(5)).unwrap();
    sender
        .try_send(CaptureEvent::Chunk(CaptureChunk {
            sequence: 999,
            index: 0,
            total: 1,
            data: "skip".into(),
        }))
        .unwrap();
    let payload = valid_payload();
    sender
        .try_send(CaptureEvent::Chunk(CaptureChunk {
            sequence: 5,
            index: 0,
            total: 1,
            data: payload,
        }))
        .unwrap();
    let snapshot = session
        .capture("https://example.test/section/page")
        .await
        .unwrap();
    assert_eq!(snapshot.html, "ok");
}
