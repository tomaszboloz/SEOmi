use super::{
    models::{CaptureChunk, CaptureEvent, MAX_CAPTURE_CHUNKS, MAX_CAPTURE_CHUNK_BYTES},
    session::RenderedCrawlerSession,
};
use crate::utils::test_app::StorageApp;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use tauri::{
    test::{mock_builder, MockRuntime},
    WebviewWindowBuilder,
};
use tokio::sync::mpsc;

fn fixture(events: Vec<CaptureEvent>) -> (StorageApp, RenderedCrawlerSession<MockRuntime>) {
    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(
        &app.app,
        format!("cap-err-{}", uuid::Uuid::new_v4().simple()),
        Default::default(),
    )
    .build()
    .unwrap();
    let (sender, receiver) = mpsc::channel(events.len().max(1) + 1);
    for event in events {
        sender.try_send(event).unwrap();
    }
    drop(sender);
    let session = RenderedCrawlerSession {
        window,
        proxy: None,
        receiver,
        nonce: "err-test-nonce".into(),
        requested_url: "https://example.test/".into(),
        initial_load_pending: true,
        base_host: "example.test".into(),
        allow_subdomains: false,
        scope_path: None,
        allowed_hosts: Vec::new(),
    };
    (app, session)
}

fn chunk(sequence: u64, index: usize, total: usize, data: impl Into<String>) -> CaptureEvent {
    CaptureEvent::Chunk(CaptureChunk {
        sequence,
        index,
        total,
        data: data.into(),
    })
}

async fn capture_err(events: Vec<CaptureEvent>) -> String {
    let (_app, mut session) = fixture(events);
    session.capture("https://example.test/").await.unwrap_err()
}

#[tokio::test]
async fn capture_channel_closed_or_early_navigation() {
    assert_eq!(
        capture_err(vec![]).await,
        "Renderer capture channel closed."
    );
    assert_eq!(
        capture_err(vec![CaptureEvent::TransferFailed(1)]).await,
        "Renderer capture channel closed."
    );
    assert_eq!(
        capture_err(vec![CaptureEvent::PageReady(1), CaptureEvent::PageReady(2)]).await,
        "The page navigated again before its rendered snapshot completed."
    );
    assert_eq!(
        capture_err(vec![
            CaptureEvent::PageReady(5),
            CaptureEvent::TransferFailed(5)
        ])
        .await,
        "Renderer capture transfer failed after bounded retries."
    );
}

#[tokio::test]
async fn capture_chunk_bounds_and_total_disagreement() {
    let seq = 10;
    assert_eq!(
        capture_err(vec![CaptureEvent::PageReady(seq), chunk(seq, 0, 0, "x")]).await,
        "Renderer returned an invalid capture chunk."
    );
    assert_eq!(
        capture_err(vec![
            CaptureEvent::PageReady(seq),
            chunk(seq, 0, MAX_CAPTURE_CHUNKS + 1, "x")
        ])
        .await,
        "Renderer returned an invalid capture chunk."
    );
    assert_eq!(
        capture_err(vec![CaptureEvent::PageReady(seq), chunk(seq, 1, 1, "x")]).await,
        "Renderer returned an invalid capture chunk."
    );
    let large = "a".repeat(MAX_CAPTURE_CHUNK_BYTES + 1);
    assert_eq!(
        capture_err(vec![CaptureEvent::PageReady(seq), chunk(seq, 0, 1, large)]).await,
        "Renderer returned an invalid capture chunk."
    );
    assert_eq!(
        capture_err(vec![
            CaptureEvent::PageReady(seq),
            chunk(seq, 0, 3, "a"),
            chunk(seq, 1, 2, "b")
        ])
        .await,
        "Renderer capture chunks disagree about the total count."
    );
}

#[tokio::test]
async fn capture_invalid_base64_and_json_payloads() {
    let seq = 3;
    assert_eq!(
        capture_err(vec![
            CaptureEvent::PageReady(seq),
            chunk(seq, 0, 1, "invalid!base64!url==")
        ])
        .await,
        "Renderer snapshot is not valid base64url."
    );
    let bad_json = URL_SAFE_NO_PAD.encode(b"{not: valid json}");
    let err = capture_err(vec![
        CaptureEvent::PageReady(seq),
        chunk(seq, 0, 1, bad_json),
    ])
    .await;
    assert!(err.starts_with("Renderer returned invalid snapshot JSON:"));
}

#[test]
fn format_capture_acknowledgement_matches_expected_custom_event() {
    use super::capture_acknowledgement::format_capture_acknowledgement;
    let ack = format_capture_acknowledgement("\"my-nonce\"", 42, 3);
    assert_eq!(
        ack,
        "window.dispatchEvent(new CustomEvent('seomi-capture-ack', {detail: {nonce: \"my-nonce\", sequence: 42, index: 3}}));"
    );
}
