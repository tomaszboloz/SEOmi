use super::models::RenderWorkerRequest;
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;

#[tokio::test]
async fn invalid_target_is_rejected_before_starting_a_renderer_session() {
    let app = StorageApp::new(mock_builder());
    let handle = app.handle();
    let error = super::render::render_request(
        &handle,
        RenderWorkerRequest {
            url: "https://[".into(),
            allow_subdomains: false,
            scope_path: None,
            wait_for_selector: None,
            wait_delay_ms: 0,
            lazy_scroll_cycles: 0,
        },
    )
    .await
    .unwrap_err();

    assert!(!error.is_empty());
}

#[tokio::test]
async fn valid_target_opens_a_renderer_session_and_reports_the_closed_capture_channel() {
    let app = StorageApp::new(mock_builder());
    let handle = app.handle();
    let error = super::render::render_request(
        &handle,
        RenderWorkerRequest {
            url: "https://example.test/docs/".into(),
            allow_subdomains: true,
            scope_path: Some("/docs/".into()),
            wait_for_selector: Some("#ready".into()),
            wait_delay_ms: 5,
            lazy_scroll_cycles: 1,
        },
    )
    .await
    .unwrap_err();

    assert_eq!(error, "Renderer capture channel closed.");
}

#[test]
fn scope_paths_must_be_absolute_and_free_of_null_characters() {
    use super::render::normalize_scope_path;
    assert_eq!(normalize_scope_path(None), Ok(None));
    assert_eq!(normalize_scope_path(Some("  ")), Ok(None));
    assert_eq!(
        normalize_scope_path(Some("/docs//")),
        Ok(Some("/docs".to_string()))
    );
    assert_eq!(
        normalize_scope_path(Some("docs")).unwrap_err(),
        "scopePath must be an absolute URL path without null characters."
    );
    assert_eq!(
        normalize_scope_path(Some("/a\0b")).unwrap_err(),
        "scopePath contains an invalid null character."
    );
}
