use super::{
    models::{
        CaptureChunk, CaptureEvent, RenderedArtifactKind, MAX_CAPTURE_CHUNKS,
        MAX_CAPTURE_CHUNK_BYTES,
    },
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
    events: Vec<CaptureEvent>,
    scope_path: Option<&'static str>,
) -> (StorageApp, RenderedCrawlerSession<MockRuntime>) {
    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(
        &app.app,
        format!("cap-cov-{}", uuid::Uuid::new_v4().simple()),
        Default::default(),
    )
    .build()
    .unwrap();
    let (sender, receiver) = mpsc::channel(events.len().max(1) + 2);
    for event in events {
        sender.try_send(event).unwrap();
    }
    drop(sender);
    let session = RenderedCrawlerSession {
        window,
        proxy: None,
        receiver,
        nonce: "test-nonce".into(),
        requested_url: "https://example.test/".into(),
        initial_load_pending: true,
        base_host: "example.test".into(),
        allow_subdomains: false,
        scope_path: scope_path.map(String::from),
        allowed_hosts: Vec::new(),
    };
    (app, session)
}

fn chunk(seq: u64, index: usize, total: usize, data: &str) -> CaptureEvent {
    CaptureEvent::Chunk(CaptureChunk {
        sequence: seq,
        index,
        total,
        data: data.to_string(),
    })
}

async fn check_err(
    events: Vec<CaptureEvent>,
    path: Option<&'static str>,
    url: &str,
    expected: &str,
) {
    let (_app, mut session) = fixture(events, path);
    let err = session.capture(url).await.unwrap_err();
    assert!(err.contains(expected), "got: {err}, expected: {expected}");
}

#[path = "tests_capture_coverage_part1.rs"]
mod part1;
