use super::*;

fn invoke(
    view: &tauri::WebviewWindow<MockRuntime>,
    command: &str,
    body: Value,
) -> Result<Value, Value> {
    tauri::test::get_ipc_response(
        view,
        tauri::webview::InvokeRequest {
            cmd: command.into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: if cfg!(windows) {
                "http://tauri.localhost"
            } else {
                "tauri://localhost"
            }
            .parse()
            .unwrap(),
            body: tauri::ipc::InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        },
    )
    .map(|response| response.deserialize().unwrap())
}

#[test]
fn generated_command_handlers_preserve_camel_case_ipc_payloads_and_errors() {
    let fixture = Fixture::new();
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    let snapshot = json!({"items":[],"run":null});
    assert_eq!(
        invoke(
            &view,
            "save_project_audit_queue",
            json!({"projectId":"one","snapshot":snapshot})
        )
        .unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(
            &view,
            "load_project_audit_queue",
            json!({"projectId":"one"})
        )
        .unwrap(),
        snapshot
    );
    assert!(invoke(
        &view,
        "load_project_audit_queue",
        json!({"projectId":"../escape"})
    )
    .unwrap_err()
    .as_str()
    .unwrap()
    .contains("Invalid project"));
    assert_eq!(
        invoke(
            &view,
            "list_project_audit_queue_results",
            json!({"projectId":"one"})
        )
        .unwrap(),
        json!([])
    );
    assert_eq!(
        invoke(
            &view,
            "list_project_audit_queue_executions",
            json!({"projectId":"one"})
        )
        .unwrap(),
        json!([])
    );
    assert_eq!(
        invoke(
            &view,
            "acknowledge_project_audit_queue_result",
            json!({"projectId":"one","runId":"run","itemId":"item"})
        )
        .unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(
            &view,
            "acknowledge_project_audit_queue_execution",
            json!({"projectId":"one","runId":"run"})
        )
        .unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(
            &view,
            "delete_project_audit_queue",
            json!({"projectId":"one"})
        )
        .unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(
            &view,
            "load_project_audit_queue",
            json!({"projectId":"one"})
        )
        .unwrap(),
        Value::Null
    );
}
