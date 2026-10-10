use super::{
    models::{CaptureEvent, RenderedArtifactKind},
    session::RenderedCrawlerSession,
};
use crate::utils::test_app::StorageApp;
use tauri::{
    test::{mock_builder, MockRuntime},
    Manager, WebviewWindowBuilder,
};
use tokio::sync::mpsc;

fn fixture() -> (StorageApp, RenderedCrawlerSession<MockRuntime>) {
    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(&app.app, "lifecycle-test", Default::default())
        .build()
        .unwrap();
    let (_sender, receiver) = mpsc::channel::<CaptureEvent>(1);
    let session = RenderedCrawlerSession {
        window,
        proxy: None,
        receiver,
        nonce: "lifecycle-test-nonce".into(),
        requested_url: "https://example.test/".into(),
        initial_load_pending: true,
        base_host: "example.test".into(),
        allow_subdomains: false,
        scope_path: None,
        allowed_hosts: Vec::new(),
    };
    (app, session)
}

#[tokio::test]
async fn capture_artifact_reports_mock_runtime_boundary() {
    let (_app, session) = fixture();
    let error = session
        .capture_artifact(RenderedArtifactKind::Pdf)
        .await
        .unwrap_err();
    assert_eq!(
        error,
        "Rendered artifact capture requires the native Wry runtime."
    );
}

#[test]
fn close_is_safe_on_the_mock_runtime() {
    let (app, session) = fixture();
    assert!(app.app.get_webview_window("lifecycle-test").is_some());
    session.close();
    // MockRuntime does not update the manager registry when a window receives
    // close(), while native Wry removes the actual window. The assertion above
    // and the successful consuming call still cover the lifecycle boundary.
    assert!(app.app.get_webview_window("lifecycle-test").is_some());
}

#[tokio::test]
async fn session_open_succeeds_on_mock_runtime() {
    let app = StorageApp::new(mock_builder());
    let session = RenderedCrawlerSession::open(
        &app.handle(),
        "https://example.test/",
        "example.test",
        false,
        None,
        Default::default(),
    )
    .await
    .unwrap();
    assert_eq!(session.base_host, "example.test");
    assert_eq!(session.requested_url, "https://example.test/");
    assert!(session.initial_load_pending);
    session.close();
}
