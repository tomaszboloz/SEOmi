use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

#[tokio::test]
async fn ai_provider_ipc_commands_reject_unsupported_providers() {
    let fixture = StorageApp::new(mock_builder().invoke_handler(tauri::generate_handler![
        super::ai_generate_text,
        super::ai_generate_suggestions,
        super::ai_list_models,
        super::ai_test_connection
    ]));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    let prompt = json!({ "provider": "none", "model": "m", "prompt": "p" });
    for command in ["ai_generate_text", "ai_generate_suggestions"] {
        let error = invoke(&view, command, prompt.clone()).unwrap_err();
        assert_eq!(error, json!("Unsupported AI provider."));
    }
    for command in ["ai_list_models", "ai_test_connection"] {
        let error = invoke(&view, command, json!({ "provider": "none" })).unwrap_err();
        assert_eq!(error, json!("Unsupported AI provider."));
    }
}
