use super::*;
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::{json, Value};
use tauri::test::mock_builder;

fn setup_view() -> (StorageApp, tauri::WebviewWindow<tauri::test::MockRuntime>) {
    let fixture = StorageApp::new(mock_builder().invoke_handler(tauri::generate_handler![
        get_config,
        save_config,
        get_secret,
        set_secret,
        save_crawl_auth_profile,
        delete_crawl_auth_profile
    ]));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    (fixture, view)
}

#[tokio::test]
async fn get_and_save_config_ipc_round_trip_and_validation() {
    let (_fixture, view) = setup_view();

    let initial = invoke(&view, "get_config", json!({})).unwrap();
    assert_eq!(initial["theme"], "dark");
    assert_eq!(initial["language"], "en");

    let mut updated = initial.clone();
    updated["theme"] = json!("light");
    updated["language"] = json!("pl");
    updated["request_timeout_secs"] = json!(30);

    assert_eq!(
        invoke(&view, "save_config", json!({ "config": updated })).unwrap(),
        Value::Null
    );

    let reloaded = invoke(&view, "get_config", json!({})).unwrap();
    assert_eq!(reloaded["theme"], "light");
    assert_eq!(reloaded["language"], "pl");
    assert_eq!(reloaded["request_timeout_secs"], 30);

    let mut invalid = initial;
    invalid["theme"] = json!("unsupported");
    let err = invoke(&view, "save_config", json!({ "config": invalid })).unwrap_err();
    assert_eq!(err, json!("Unsupported configuration theme."));
}

#[tokio::test]
async fn secret_and_auth_profile_ipc_commands_round_trip() {
    let (_fixture, view) = setup_view();

    assert!(invoke(&view, "get_secret", json!({ "name": "test_key" })).is_err());
    assert!(invoke(
        &view,
        "set_secret",
        json!({ "name": "test_key", "value": "test_val" })
    )
    .is_err());

    assert_eq!(
        invoke(
            &view,
            "set_secret",
            json!({ "name": "openai_api_key", "value": "test_val" })
        )
        .unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(&view, "get_secret", json!({ "name": "openai_api_key" })).unwrap(),
        json!("test_val")
    );
    let _ = secure_store::secret_entry("openai_api_key")
        .unwrap()
        .delete_credential();

    assert_eq!(
        invoke(
            &view,
            "save_crawl_auth_profile",
            json!({
                "projectId": "test-p",
                "profileId": "test-prof",
                "headers": [],
                "cookie": null,
                "proxyUrl": null
            })
        )
        .unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(
            &view,
            "delete_crawl_auth_profile",
            json!({ "projectId": "test-p", "profileId": "test-prof" })
        )
        .unwrap(),
        Value::Null
    );

    assert!(invoke(
        &view,
        "save_crawl_auth_profile",
        json!({
            "projectId": "invalid/p",
            "profileId": "test-prof",
            "headers": [],
            "cookie": null,
            "proxyUrl": null
        })
    )
    .is_err());
    assert!(invoke(
        &view,
        "delete_crawl_auth_profile",
        json!({ "projectId": "invalid/p", "profileId": "test-prof" })
    )
    .is_err());
}
