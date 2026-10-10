use super::*;

#[test]
fn registered_commands_accept_frontend_payloads_and_return_serialized_handoff() {
    let app = fixture();
    let view = tauri::WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap();
    let body = json!({"projectId":"project-1","task":tests::manifest()});
    assert_eq!(
        invoke(&view, "save_scheduled_task", body).unwrap(),
        Value::Null
    );
    let query = json!({"projectId":"project-1","scheduleId":"schedule-1"});
    assert_eq!(
        invoke(&view, "load_scheduled_execution", query.clone()).unwrap(),
        Value::Null
    );
    store(&app, &handoff("schedule-1", false));
    let loaded = invoke(&view, "load_scheduled_execution", query.clone()).unwrap();
    assert_eq!(loaded["scheduleId"], "schedule-1");
    assert_eq!(loaded["succeeded"], false);
    assert!(loaded.get("schedule_id").is_none());
    let list = invoke(
        &view,
        "list_scheduled_executions",
        json!({"projectId":"project-1"}),
    )
    .unwrap();
    assert_eq!(list, json!([loaded]));
    assert_eq!(
        invoke(&view, "acknowledge_scheduled_execution", query.clone()).unwrap(),
        Value::Null
    );
    assert_eq!(
        invoke(&view, "delete_scheduled_task", query).unwrap(),
        Value::Null
    );
    assert!(invoke(
        &view,
        "list_scheduled_executions",
        json!({"projectId":"../escape"})
    )
    .is_err());
}
