//! Drives the composed (shipped) handler table for commands whose generated
//! wrappers are only instantiated by `compose`.
use crate::utils::test_app::invoke;
use serde_json::json;
use tauri::{
    test::{mock_context, noop_assets},
    Manager,
};

#[test]
fn composed_search_console_updater_and_link_commands_answer_over_ipc() {
    let mut context = mock_context(noop_assets());
    context.config_mut().identifier = format!("seomi-compose-{}", uuid::Uuid::new_v4());
    context.config_mut().bundle.active = false;
    context
        .config_mut()
        .plugins
        .0
        .insert("updater".into(), json!({ "pubkey": "", "endpoints": [] }));
    let app = super::compose(
        tauri::test::mock_builder().plugin(tauri_plugin_updater::Builder::new().build()),
    )
    .build(context)
    .unwrap();
    let view = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let site = "https://example.test";
    let bad = [
        (
            "connect_search_console",
            json!({"projectId": "p", "clientId": "c", "clientSecret": null}),
        ),
        (
            "list_search_console_properties",
            json!({"projectId": "p", "clientId": "c"}),
        ),
        (
            "search_console_performance",
            json!({"projectId": "p", "clientId": "c", "siteUrl": site,
                   "startDate": null, "endDate": null, "filters": null}),
        ),
        (
            "inspect_search_console_url",
            json!({"projectId": "p", "clientId": "c", "siteUrl": site, "inspectionUrl": site}),
        ),
        (
            "disconnect_search_console",
            json!({"projectId": "invalid/project"}),
        ),
        ("check_for_updates", json!({})),
        ("install_update", json!({})),
        ("check_link", json!({"url": "", "timeoutSecs": null})),
    ];
    for (command, body) in bad {
        assert!(invoke(&view, command, body).is_err(), "{command}");
    }
    let root = app.path().app_data_dir().unwrap();
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn desktop_builder_assembles_the_shipped_plugins_without_an_event_loop() {
    let _builder: tauri::Builder<tauri::Wry> = super::desktop_builder();
}
