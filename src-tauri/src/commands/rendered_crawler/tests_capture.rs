use super::models::{CaptureChunk, CaptureEvent, MAX_CAPTURE_CHUNKS, MAX_CAPTURE_CHUNK_BYTES};
use super::session::RenderedCrawlerSession;
use crate::utils::test_app::StorageApp;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use tauri::{
    test::{mock_builder, MockRuntime},
    WebviewWindowBuilder,
};
use tokio::sync::mpsc;
fn fixture(events: Vec<CaptureEvent>) -> (StorageApp, RenderedCrawlerSession<MockRuntime>) {
    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(&app.app, "capture-test", Default::default())
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
        nonce: "capture-test-nonce".into(),
        requested_url: "https://example.test/".into(),
        initial_load_pending: true,
        base_host: "example.test".into(),
        allow_subdomains: false,
        scope_path: None,
        allowed_hosts: Vec::new(),
    };
    (app, session)
}

fn encoded_payload() -> String {
    URL_SAFE_NO_PAD.encode(
        br#"{"page_url":"https://example.test/final","http_status":200,"content_type":"text/html","charset":"utf-8","html":"<main>ok</main>","html_truncated":false,"navigation_time_ms":12,"lcp_ms":45,"inp_ms":3,"cls":0.1,"failed_resource_urls":[],"console_errors":[]}"#,
    )
}

async fn capture_error(events: Vec<CaptureEvent>) -> String {
    let (_app, mut session) = fixture(events);
    session.capture("https://example.test/").await.unwrap_err()
}

fn chunk(sequence: u64, index: usize, total: usize, data: impl Into<String>) -> CaptureEvent {
    CaptureEvent::Chunk(CaptureChunk {
        sequence,
        index,
        total,
        data: data.into(),
    })
}

#[tokio::test]
async fn capture_assembles_chunks_into_a_snapshot() {
    let encoded = encoded_payload();
    let split = encoded.len() / 2;
    let (_app, mut session) = fixture(vec![
        CaptureEvent::PageReady(7),
        chunk(7, 0, 2, &encoded[..split]),
        chunk(7, 1, 2, &encoded[split..]),
    ]);
    let snapshot = session.capture("https://example.test/").await.unwrap();
    assert_eq!(snapshot.final_url, "https://example.test/final");
    assert_eq!(snapshot.http_status, Some(200));
    assert_eq!(snapshot.html, "<main>ok</main>");
    assert_eq!(snapshot.lcp_ms, Some(45));
    assert_eq!(snapshot.cls, Some(0.1));
}

#[tokio::test]
async fn capture_reports_closed_channel_and_transfer_failures() {
    assert_eq!(
        capture_error(Vec::new()).await,
        "Renderer capture channel closed."
    );
    assert_eq!(
        capture_error(vec![
            CaptureEvent::PageReady(2),
            CaptureEvent::TransferFailed(2)
        ])
        .await,
        "Renderer capture transfer failed after bounded retries."
    );
    assert_eq!(
        capture_error(vec![CaptureEvent::PageReady(2), CaptureEvent::PageReady(3)]).await,
        "The page navigated again before its rendered snapshot completed."
    );
    assert_eq!(
        capture_error(vec![CaptureEvent::PageReady(2), CaptureEvent::PageReady(1)]).await,
        "Renderer capture channel closed before completion."
    );
    assert_eq!(
        capture_error(vec![
            CaptureEvent::PageReady(2),
            CaptureEvent::TransferFailed(1)
        ])
        .await,
        "Renderer capture channel closed before completion."
    );
}

#[tokio::test]
async fn capture_rejects_invalid_chunk_shape_and_total_changes() {
    for chunk in [
        chunk(1, 0, 0, "x"),
        chunk(1, 0, MAX_CAPTURE_CHUNKS + 1, "x"),
        chunk(1, 2, 2, "x"),
        chunk(1, 0, 1, "x".repeat(MAX_CAPTURE_CHUNK_BYTES + 1)),
    ] {
        assert_eq!(
            capture_error(vec![CaptureEvent::PageReady(1), chunk]).await,
            "Renderer returned an invalid capture chunk."
        );
    }
    let mismatch = vec![
        CaptureEvent::PageReady(1),
        chunk(1, 0, 2, "x"),
        chunk(1, 1, 3, "y"),
    ];
    assert_eq!(
        capture_error(mismatch).await,
        "Renderer capture chunks disagree about the total count."
    );
}

#[tokio::test]
async fn capture_handles_duplicate_chunks_and_bad_payloads() {
    let duplicate = vec![
        CaptureEvent::PageReady(1),
        chunk(1, 0, 2, "e"),
        chunk(1, 0, 2, "e"),
    ];
    assert_eq!(
        capture_error(duplicate).await,
        "Renderer capture channel closed before completion."
    );
    assert_eq!(
        capture_error(vec![CaptureEvent::PageReady(1), chunk(1, 0, 1, "!")]).await,
        "Renderer snapshot is not valid base64url."
    );
    let invalid_json = URL_SAFE_NO_PAD.encode(b"not-json");
    assert!(capture_error(vec![
        CaptureEvent::PageReady(1),
        chunk(1, 0, 1, invalid_json),
    ])
    .await
    .starts_with("Renderer returned invalid snapshot JSON:"));
}
