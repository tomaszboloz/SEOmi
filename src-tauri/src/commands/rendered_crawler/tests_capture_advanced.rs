use super::{
    models::{CaptureChunk, CaptureEvent, RenderedArtifactKind},
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
        format!("capture-adv-{}", uuid::Uuid::new_v4().simple()),
        Default::default(),
    )
    .build()
    .unwrap();
    let (sender, receiver) = mpsc::channel(32);
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

fn valid_payload(url: &str) -> String {
    let raw = serde_json::json!({
        "page_url": url,
        "http_status": 200,
        "content_type": "text/html",
        "charset": "utf-8",
        "html": "<html><body>advanced</body></html>",
        "html_truncated": false,
        "navigation_time_ms": 15,
        "lcp_ms": 30,
        "inp_ms": 2,
        "cls": 0.05,
        "failed_resource_urls": [],
        "console_errors": []
    });
    URL_SAFE_NO_PAD.encode(serde_json::to_vec(&raw).unwrap())
}

#[tokio::test]
async fn capture_renavigates_when_requested_url_differs_from_initial() {
    let (_app, mut session, sender) = fixture(true, "https://example.test/section/first");
    sender.try_send(CaptureEvent::TransferFailed(999)).unwrap();

    let target_url = "https://example.test/section/second";
    tokio::spawn(async move {
        tokio::task::yield_now().await;
        let _ = sender.send(CaptureEvent::PageReady(1)).await;
        let payload = valid_payload(target_url);
        let _ = sender
            .send(CaptureEvent::Chunk(CaptureChunk {
                sequence: 1,
                index: 0,
                total: 1,
                data: payload,
            }))
            .await;
    });

    let snapshot = session.capture(target_url).await.unwrap();
    assert_eq!(snapshot.requested_url, target_url);
    assert_eq!(snapshot.final_url, target_url);
    assert_eq!(session.requested_url, target_url);
    assert!(!session.initial_load_pending);
}

#[tokio::test]
async fn capture_handles_closed_channel_mid_stream_and_out_of_scope() {
    let (_app, mut session, sender) = fixture(true, "https://example.test/section/page");
    sender.send(CaptureEvent::PageReady(1)).await.unwrap();
    sender
        .send(CaptureEvent::Chunk(CaptureChunk {
            sequence: 1,
            index: 0,
            total: 2,
            data: "incomplete".into(),
        }))
        .await
        .unwrap();
    drop(sender);

    let err = session
        .capture("https://example.test/section/page")
        .await
        .unwrap_err();
    assert_eq!(err, "Renderer capture channel closed before completion.");

    let sub_err = session
        .capture("https://sub.example.test/section/page")
        .await
        .unwrap_err();
    assert_eq!(
        sub_err,
        "The rendered URL is outside the configured crawl scope."
    );
}

#[tokio::test]
async fn capture_artifact_screenshot_fails_on_mock_runtime() {
    let (_app, session, _sender) = fixture(true, "https://example.test/section/page");
    let err = session
        .capture_artifact(RenderedArtifactKind::Screenshot)
        .await
        .unwrap_err();
    assert_eq!(
        err,
        "Rendered artifact capture requires the native Wry runtime."
    );
}
