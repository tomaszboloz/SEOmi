use super::*;

#[test]
fn execution_and_result_commands_keep_ownership_and_acknowledge_only_target() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    assert!(
        list_project_audit_queue_executions(app.clone(), "one".into())
            .unwrap()
            .is_empty()
    );
    assert!(list_project_audit_queue_results(app.clone(), "one".into())
        .unwrap()
        .is_empty());
    write_queue_execution(&app, "one", "run", &json!({"run":"run", "error":"Żółć"})).unwrap();
    write_queue_result(&app, "one", "run", "first", &json!({"item":"first"})).unwrap();
    write_queue_result(&app, "one", "run", "second", &json!({"item":"second"})).unwrap();
    assert_eq!(
        list_project_audit_queue_executions(app.clone(), "one".into()).unwrap(),
        vec![json!({"run":"run", "error":"Żółć"})]
    );
    let mut results = list_project_audit_queue_results(app.clone(), "one".into()).unwrap();
    results.sort_by_key(|v| v["item"].as_str().unwrap().to_string());
    assert_eq!(
        results,
        vec![json!({"item":"first"}), json!({"item":"second"})]
    );
    assert!(list_project_audit_queue_results(app.clone(), "two".into())
        .unwrap()
        .is_empty());
    acknowledge_project_audit_queue_result(app.clone(), "one".into(), "run".into(), "first".into())
        .unwrap();
    acknowledge_project_audit_queue_result(app.clone(), "one".into(), "run".into(), "first".into())
        .unwrap();
    assert_eq!(
        list_project_audit_queue_results(app.clone(), "one".into()).unwrap(),
        vec![json!({"item":"second"})]
    );
    acknowledge_project_audit_queue_execution(app.clone(), "one".into(), "run".into()).unwrap();
    acknowledge_project_audit_queue_execution(app.clone(), "one".into(), "run".into()).unwrap();
    assert!(list_project_audit_queue_executions(app, "one".into())
        .unwrap()
        .is_empty());
}
