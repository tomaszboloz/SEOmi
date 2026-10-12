use super::commands::{
    artifact_with_session, capture_rendered_artifact, finish_artifact, render_crawl_page,
    render_with_session,
};
use super::models::{CaptureChunk, CaptureEvent, RenderedArtifactKind, RenderedPageSnapshot};
use super::session::RenderedCrawlerSession;
use crate::utils::test_app::StorageApp;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use tauri::{
    test::{mock_builder, MockRuntime},
    WebviewWindowBuilder,
};
use tokio::sync::mpsc;

fn session(events: Vec<CaptureEvent>) -> (StorageApp, RenderedCrawlerSession<MockRuntime>) {
    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(&app.app, "flow-test", Default::default())
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
        nonce: "flow-nonce".into(),
        requested_url: "https://example.test/".into(),
        initial_load_pending: true,
        base_host: "example.test".into(),
        allow_subdomains: false,
        scope_path: None,
        allowed_hosts: Vec::new(),
    };
    (app, session)
}

fn ready_events() -> Vec<CaptureEvent> {
    let payload = URL_SAFE_NO_PAD.encode(
        br#"{"page_url":"https://example.test/final","http_status":200,"content_type":"text/html","charset":"utf-8","html":"<main>ok</main>","html_truncated":false,"navigation_time_ms":1,"lcp_ms":null,"inp_ms":null,"cls":null,"failed_resource_urls":[],"console_errors":[]}"#,
    );
    vec![
        CaptureEvent::PageReady(1),
        CaptureEvent::Chunk(CaptureChunk {
            sequence: 1,
            index: 0,
            total: 1,
            data: payload,
        }),
    ]
}

fn snapshot() -> RenderedPageSnapshot {
    let (_app, mut session) = session(ready_events());
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    runtime
        .block_on(session.capture("https://example.test/"))
        .unwrap()
}

#[tokio::test]
async fn render_crawl_page_opens_a_session_and_reports_the_closed_capture_channel() {
    let app = StorageApp::new(mock_builder());
    let error = render_crawl_page(
        app.handle(),
        "https://Example.test/page".into(),
        true,
        Some("/page".into()),
        Some("  #ready  ".into()),
        Some(99_999),
        Some(500),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Renderer capture channel closed.");
}

#[tokio::test]
async fn capture_rendered_artifact_opens_a_session_and_reports_the_closed_capture_channel() {
    let app = StorageApp::new(mock_builder());
    let error = capture_rendered_artifact(
        app.handle(),
        "https://example.test/".into(),
        false,
        None,
        Some("   ".into()),
        None,
        None,
        "pdf".into(),
        Some("run".into()),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Renderer capture channel closed.");
}

#[tokio::test]
async fn render_with_session_returns_the_snapshot_and_closes_the_window() {
    let (_app, session) = session(ready_events());
    let snapshot = render_with_session(session, "https://example.test/")
        .await
        .unwrap();
    assert_eq!(snapshot.final_url, "https://example.test/final");
}

#[tokio::test]
async fn artifact_with_session_surfaces_capture_and_native_artifact_failures() {
    let (_app, failing) = session(Vec::new());
    let error = artifact_with_session(
        failing,
        "https://example.test/",
        RenderedArtifactKind::Pdf,
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Renderer capture channel closed.");

    let (_app, mock) = session(ready_events());
    let error = artifact_with_session(
        mock,
        "https://example.test/",
        RenderedArtifactKind::Pdf,
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(
        error,
        "Rendered artifact capture requires the native Wry runtime."
    );
}

#[test]
fn finish_artifact_builds_a_bounded_named_artifact_or_forwards_errors() {
    let artifact = finish_artifact(
        Ok(snapshot()),
        Ok(b"%PDF".to_vec()),
        RenderedArtifactKind::Pdf,
        Some(format!("  {}  ", "r".repeat(200))),
    )
    .unwrap();
    assert_eq!(artifact.requested_url, "https://example.test/");
    assert_eq!(artifact.final_url, "https://example.test/final");
    assert_eq!(artifact.run_id.as_deref().map(str::len), Some(128));
    assert_eq!(artifact.artifact_type, "pdf");
    assert_eq!(artifact.content_type, "application/pdf");
    assert!(artifact.file_name.starts_with("rendered-page-"));
    assert!(artifact.file_name.ends_with("-pdf.pdf"));
    assert_eq!(artifact.bytes, 4);
    assert_eq!(artifact.data_base64, "JVBERg==");
    assert!(!artifact.captured_at.is_empty());
    assert!(!artifact.renderer_platform.is_empty());

    let blank = finish_artifact(
        Ok(snapshot()),
        Ok(Vec::new()),
        RenderedArtifactKind::Screenshot,
        Some("   ".into()),
    )
    .unwrap();
    assert_eq!(blank.run_id, None);
    assert_eq!(blank.content_type, "image/png");

    assert_eq!(
        finish_artifact(
            Err("capture".into()),
            Ok(Vec::new()),
            RenderedArtifactKind::Pdf,
            None
        )
        .unwrap_err(),
        "capture"
    );
    assert_eq!(
        finish_artifact(
            Ok(snapshot()),
            Err("bytes".into()),
            RenderedArtifactKind::Pdf,
            None
        )
        .unwrap_err(),
        "bytes"
    );
}
