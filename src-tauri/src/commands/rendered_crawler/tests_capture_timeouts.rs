use super::{
    models::{CaptureChunk, CaptureEvent},
    session::RenderedCrawlerSession,
};
use crate::utils::test_app::StorageApp;
use std::time::Duration;
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
        format!("capture-to-{}", uuid::Uuid::new_v4().simple()),
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

#[tokio::test(start_paused = true)]
async fn capture_times_out_when_chunk_transfer_stalls() {
    let (_app, mut session, sender) = fixture(true, "https://example.test/section/page");
    sender.send(CaptureEvent::PageReady(1)).await.unwrap();
    sender
        .send(CaptureEvent::Chunk(CaptureChunk {
            sequence: 1,
            index: 0,
            total: 2,
            data: "first-chunk".into(),
        }))
        .await
        .unwrap();

    let handle =
        tokio::spawn(async move { session.capture("https://example.test/section/page").await });

    tokio::task::yield_now().await;
    tokio::time::advance(Duration::from_secs(3)).await;
    tokio::task::yield_now().await;
    let res = handle.await.unwrap();
    assert_eq!(res.unwrap_err(), "Renderer capture transfer stalled.");
}

#[tokio::test]
async fn capture_fails_immediately_on_closed_or_empty_channel() {
    let (_app, mut session, sender) = fixture(true, "https://example.test/section/page");
    drop(sender);

    let err = session
        .capture("https://example.test/section/page")
        .await
        .unwrap_err();
    assert_eq!(err, "Renderer capture channel closed.");
}
