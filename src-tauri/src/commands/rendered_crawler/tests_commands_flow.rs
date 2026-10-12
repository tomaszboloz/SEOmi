use super::commands::{capture_rendered_artifact, render_crawl_page};
use super::models::{CaptureChunk, CaptureEvent, RenderedPageSnapshot};
use super::session::RenderedCrawlerSession;
use crate::utils::test_app::StorageApp;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use tauri::{
    test::{mock_builder, MockRuntime},
    WebviewWindowBuilder,
};
use tokio::sync::mpsc;

pub(super) fn session(
    events: Vec<CaptureEvent>,
) -> (StorageApp, RenderedCrawlerSession<MockRuntime>) {
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

pub(super) fn ready_events() -> Vec<CaptureEvent> {
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

pub(super) fn snapshot() -> RenderedPageSnapshot {
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
