use super::*;
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

#[tokio::test]
async fn settings_ipc_commands_reject_missing_arguments_before_touching_storage() {
    let fixture = StorageApp::new(mock_builder().invoke_handler(tauri::generate_handler![
        get_config,
        save_config,
        has_secret,
        set_secret,
        save_crawl_auth_profile,
        delete_crawl_auth_profile
    ]));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    for command in [
        "save_config",
        "has_secret",
        "set_secret",
        "save_crawl_auth_profile",
        "delete_crawl_auth_profile",
    ] {
        let error = invoke(&view, command, json!({})).unwrap_err();
        assert!(error.as_str().unwrap().contains("missing required key"));
    }
}
