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
