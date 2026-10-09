use super::*;

use crate::utils::test_app::invoke;

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

#[test]
fn acknowledge_removes_existing_execution_and_result() {
    let fixture = Fixture::new();
    let app = &fixture.app;
    crate::commands::audit_queue::executions::write_queue_execution(
        app.handle(),
        "one",
        "run",
        &json!({"status":"done"}),
    )
    .unwrap();
    crate::commands::audit_queue::executions::write_queue_result(
        app.handle(),
        "one",
        "run",
        "item",
        &json!({"ok":true}),
    )
    .unwrap();
    let execution_path =
        crate::commands::audit_queue::paths::queue_execution_path(app.handle(), "one", "run")
            .unwrap();
    let result_path =
        crate::commands::audit_queue::paths::queue_result_path(app.handle(), "one", "run", "item")
            .unwrap();
    assert!(execution_path.exists());
    assert!(result_path.exists());

    let view = tauri::WebviewWindowBuilder::new(app, "main", Default::default())
        .build()
        .unwrap();
    assert_eq!(
        invoke(
            &view,
            "acknowledge_project_audit_queue_execution",
            json!({"projectId":"one","runId":"run"}),
        )
        .unwrap(),
        Value::Null
    );
    assert!(!execution_path.exists());
    assert_eq!(
        invoke(
            &view,
            "acknowledge_project_audit_queue_result",
            json!({"projectId":"one","runId":"run","itemId":"item"}),
        )
        .unwrap(),
        Value::Null
    );
    assert!(!result_path.exists());
}
