use super::{client_unavailable, fetch_public_feed};
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

#[tokio::test]
async fn fetch_public_feed_ipc_validates_arguments_before_any_request() {
    let fixture =
        StorageApp::new(mock_builder().invoke_handler(tauri::generate_handler![fetch_public_feed]));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    let error = invoke(
        &view,
        "fetch_public_feed",
        json!({ "feed": "", "geo": "PL", "keyword": "seo", "language": "pl" }),
    )
    .unwrap_err();
    assert_eq!(error, json!("Unsupported public feed."));
}

#[test]
fn client_construction_failures_use_the_stable_message() {
    let error = reqwest::Proxy::all("http://").unwrap_err();
    assert_eq!(
        client_unavailable(error),
        "Unable to create public feed client."
    );
}
