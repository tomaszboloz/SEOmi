use super::*;
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

#[tokio::test]
async fn search_console_ipc_commands_exercise_handlers() {
    let fixture = StorageApp::new(mock_builder().invoke_handler(tauri::generate_handler![
        connect_search_console,
        list_search_console_properties,
        search_console_performance,
        inspect_search_console_url,
        disconnect_search_console
    ]));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();

    assert!(invoke(
        &view,
        "connect_search_console",
        json!({
            "projectId": "p",
            "clientId": "c",
            "clientSecret": null
        })
    )
    .is_err());

    assert!(invoke(
        &view,
        "list_search_console_properties",
        json!({
            "projectId": "p",
            "clientId": "c"
        })
    )
    .is_err());

    assert!(invoke(
        &view,
        "search_console_performance",
        json!({
            "projectId": "p",
            "clientId": "c",
            "siteUrl": "https://example.test",
            "startDate": null,
            "endDate": null,
            "filters": null
        })
    )
    .is_err());

    assert!(invoke(
        &view,
        "inspect_search_console_url",
        json!({
            "projectId": "p",
            "clientId": "c",
            "siteUrl": "https://example.test",
            "inspectionUrl": "https://example.test/page"
        })
    )
    .is_err());

    assert!(invoke(
        &view,
        "disconnect_search_console",
        json!({ "projectId": "p" })
    )
    .is_ok());

    assert!(invoke(
        &view,
        "disconnect_search_console",
        json!({ "projectId": "invalid/project" })
    )
    .is_err());
}
