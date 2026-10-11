use super::*;
use crate::commands::audit_queue::executions::list_project_audit_queue_results_bounded;

#[test]
fn test_write_queue_execution_normal_and_exceeding() {
    let fixture = Fixture::new();
    let app = &fixture.app;
    let normal_val = json!({"status": "ok"});
    assert!(write_queue_execution(app.handle(), "proj1", "run1", &normal_val).is_ok());

    let large_str = "a".repeat(crate::commands::audit_queue::paths::MAX_QUEUE_EXECUTION_BYTES + 1);
    let large_val = json!({"data": large_str});
    assert!(write_queue_execution(app.handle(), "proj1", "run2", &large_val).is_err());
}

#[test]
fn test_write_queue_result_normal_and_exceeding() {
    let fixture = Fixture::new();
    let app = &fixture.app;
    let normal_val = json!({"ok": true});
    assert!(write_queue_result(app.handle(), "proj1", "run1", "item1", &normal_val).is_ok());

    let large_str = "a".repeat(crate::commands::audit_queue::paths::MAX_QUEUE_RESULT_BYTES + 1);
    let large_val = json!({"data": large_str});
    assert!(write_queue_result(app.handle(), "proj1", "run1", "item2", &large_val).is_err());
}

#[test]
fn test_list_project_audit_queue_executions_edge_cases() {
    let fixture = Fixture::new();
    let app = &fixture.app;
    let list =
        list_project_audit_queue_executions(app.handle().clone(), "nonexistent".into()).unwrap();
    assert!(list.is_empty());

    for i in 0..105 {
        write_queue_execution(
            app.handle(),
            "proj2",
            &format!("run{}", i),
            &json!({"index": i}),
        )
        .unwrap();
    }
    let dir = crate::commands::crawl_storage::project_directory(app.handle(), "proj2").unwrap();
    std::fs::write(dir.join("other_file.json"), "{}").unwrap();

    let list = list_project_audit_queue_executions(app.handle().clone(), "proj2".into()).unwrap();
    assert_eq!(list.len(), 100);

    std::fs::write(
        dir.join("audit_queue_execution_corrupt.json"),
        b"invalid-json",
    )
    .unwrap();
    assert!(list_project_audit_queue_executions(app.handle().clone(), "proj2".into()).is_err());
}

#[test]
fn test_list_project_audit_queue_results_edge_cases() {
    let fixture = Fixture::new();
    let app = &fixture.app;
    let list =
        list_project_audit_queue_results(app.handle().clone(), "nonexistent".into()).unwrap();
    assert!(list.is_empty());

    write_queue_result(app.handle(), "proj3", "run1", "item1", &json!({"res": 1})).unwrap();
    write_queue_result(app.handle(), "proj3", "run1", "item2", &json!({"res": 2})).unwrap();

    let bounded =
        list_project_audit_queue_results_bounded(app.handle().clone(), "proj3".into(), 1).unwrap();
    assert_eq!(bounded.len(), 1);
}

#[test]
fn test_acknowledge_project_audit_queue_result_and_execution() {
    let fixture = Fixture::new();
    let app = &fixture.app;

    assert!(acknowledge_project_audit_queue_result(
        app.handle().clone(),
        "proj4".into(),
        "run1".into(),
        "item1".into()
    )
    .is_ok());
    assert!(acknowledge_project_audit_queue_execution(
        app.handle().clone(),
        "proj4".into(),
        "run1".into()
    )
    .is_ok());

    write_queue_execution(app.handle(), "proj4", "run1", &json!({})).unwrap();
    write_queue_result(app.handle(), "proj4", "run1", "item1", &json!({})).unwrap();

    assert!(acknowledge_project_audit_queue_execution(
        app.handle().clone(),
        "proj4".into(),
        "run1".into()
    )
    .is_ok());
    assert!(acknowledge_project_audit_queue_result(
        app.handle().clone(),
        "proj4".into(),
        "run1".into(),
        "item1".into()
    )
    .is_ok());
}
