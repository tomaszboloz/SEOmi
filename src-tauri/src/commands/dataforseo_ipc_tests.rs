use super::{client_unavailable, dataforseo_request};
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

#[tokio::test]
async fn dataforseo_ipc_rejects_unknown_endpoints_before_credentials_or_network() {
    let fixture = StorageApp::new(
        mock_builder().invoke_handler(tauri::generate_handler![dataforseo_request]),
    );
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    let error = invoke(
        &view,
        "dataforseo_request",
        json!({ "projectId": "p", "path": "/v3/users/billing", "payload": null }),
    )
    .unwrap_err();
    assert_eq!(error, json!("Unsupported DataForSEO endpoint."));
}

#[test]
fn client_construction_failures_use_the_stable_message() {
    let error = reqwest::Proxy::all("http://").unwrap_err();
    assert_eq!(
        client_unavailable(error),
        "Unable to create DataForSEO client."
    );
}
