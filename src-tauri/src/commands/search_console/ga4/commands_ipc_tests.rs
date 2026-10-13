use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

#[tokio::test]
async fn ga4_ipc_handlers_reject_invalid_arguments_before_any_network_or_keychain_work() {
    let fixture = StorageApp::new(mock_builder().invoke_handler(tauri::generate_handler![
        super::commands::connect_google_analytics,
        super::commands::list_google_analytics_properties,
        super::commands::google_analytics_performance
    ]));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();

    let connect = invoke(
        &view,
        "connect_google_analytics",
        json!({ "projectId": "p", "clientId": "not-a-client", "clientSecret": null }),
    )
    .unwrap_err();
    assert!(connect.as_str().unwrap().contains("Client ID"));

    let list = invoke(
        &view,
        "list_google_analytics_properties",
        json!({ "projectId": "p", "clientId": "c", "siteUrl": "https://user:pw@example.test" }),
    )
    .unwrap_err();
    assert!(list.is_string());

    let performance = invoke(
        &view,
        "google_analytics_performance",
        json!({
            "projectId": "p", "clientId": "c", "siteUrl": "https://user:pw@example.test",
            "startDate": null, "endDate": null
        }),
    )
    .unwrap_err();
    assert!(performance.is_string());
}
