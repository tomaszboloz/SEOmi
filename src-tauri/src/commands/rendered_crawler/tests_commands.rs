use super::commands::{capture_rendered_artifact, render_crawl_page};
use super::preview::open_rendered_element_preview;
use super::session::RenderedCrawlerSession;
use crate::commands::rendered_artifacts::{capture_window_artifact, native_webview_runtime};
use crate::utils::test_app::StorageApp;
use tauri::{test::mock_builder, WebviewWindowBuilder};

fn app() -> StorageApp {
    StorageApp::new(mock_builder())
}

#[tokio::test]
async fn render_commands_reject_invalid_urls_before_opening_renderer() {
    let fixture = app();
    let error = render_crawl_page(
        fixture.handle(),
        "file:///etc/passwd".into(),
        false,
        None,
        None,
        None,
        None,
    )
    .await
    .unwrap_err();
    assert!(error.contains("Unsupported scheme 'file'"));

    let error = capture_rendered_artifact(
        fixture.handle(),
        "https://example.test/".into(),
        false,
        None,
        None,
        None,
        None,
        "html".into(),
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Rendered artifact kind must be screenshot or pdf.");

    let error = capture_rendered_artifact(
        fixture.handle(),
        "http://127.0.0.1/private".into(),
        false,
        None,
        None,
        None,
        None,
        "screenshot".into(),
        None,
    )
    .await
    .unwrap_err();
    assert!(error.contains("local/private IP addresses"));
}

#[tokio::test]
async fn rendered_session_open_rejects_invalid_start_url_before_proxy_start() {
    let fixture = app();
    let result = RenderedCrawlerSession::open(
        &fixture.handle(),
        "javascript://alert(1)",
        "example.test",
        false,
        None,
        Default::default(),
    )
    .await;
    let error = match result {
        Err(error) => error,
        Ok(_) => panic!("invalid renderer URL unexpectedly opened"),
    };
    assert!(error.contains("Unsupported scheme 'javascript'"));
}

#[tokio::test]
async fn preview_rejects_bad_input_before_scheduling_window_callback() {
    let fixture = app();
    let error = open_rendered_element_preview(
        fixture.handle(),
        "https://example.test/".into(),
        "".into(),
        None,
        None,
        "Preview".into(),
        "Not found".into(),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Preview selector cannot be empty.");

    let error = open_rendered_element_preview(
        fixture.handle(),
        "https://example.test/".into(),
        "main".into(),
        Some("\0needle".into()),
        None,
        "Preview".into(),
        "Not found".into(),
    )
    .await
    .unwrap_err();
    assert!(error.contains("Preview match text contains an invalid null character"));

    let error = open_rendered_element_preview(
        fixture.handle(),
        "https://example.test/".into(),
        "main".into(),
        None,
        None,
        "".into(),
        "Not found".into(),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Preview window title cannot be empty.");

    let error = open_rendered_element_preview(
        fixture.handle(),
        "https://example.test/".into(),
        "main".into(),
        None,
        None,
        "Preview".into(),
        "".into(),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Preview not-found message cannot be empty.");
}

#[tokio::test]
async fn mock_runtime_artifact_capture_returns_before_native_callback() {
    let fixture = app();
    let window = WebviewWindowBuilder::new(&fixture.app, "rendered-test", Default::default())
        .build()
        .unwrap();
    let error = capture_window_artifact(&window, super::models::RenderedArtifactKind::Pdf)
        .await
        .unwrap_err();
    assert_eq!(
        error,
        "Rendered artifact capture requires the native Wry runtime."
    );
    assert!(!native_webview_runtime::<tauri::test::MockRuntime>());
    assert!(native_webview_runtime::<tauri::Wry>());
}
