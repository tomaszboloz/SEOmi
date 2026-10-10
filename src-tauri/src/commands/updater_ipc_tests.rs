use super::*;
use crate::utils::test_app::invoke;
use serde_json::json;
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};

fn app() -> tauri::App<MockRuntime> {
    let mut context = mock_context(noop_assets());
    context.config_mut().bundle.active = false;
    mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            super::check_for_updates,
            super::install_update
        ])
        .build(context)
        .unwrap()
}

#[test]
fn generated_ipc_handlers_exercise_updater_commands() {
    let app_inst = app();
    let view = tauri::WebviewWindowBuilder::new(&app_inst, "main", Default::default())
        .build()
        .unwrap();
    assert!(invoke(&view, "check_for_updates", json!({})).is_err());
    assert!(invoke(&view, "install_update", json!({})).is_err());
}
