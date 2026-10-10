use super::super::super::models::MAX_EXECUTION_BYTES;
use super::super::super::storage::{execution_path, result_path, task_path, write_json_atomic};
use super::super::runner::run_scheduled_task_with;
use super::{fixture, store, task};
use serde_json::Value;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

#[tokio::test]
async fn latest_manifest_schedule_id_must_match_requested_path() {
    let app = fixture();
    let path = task_path(&app.handle(), "project-1", "schedule-1").unwrap();
    let metadata_path = execution_path(&app.handle(), "project-1", "schedule-1").unwrap();
    let result_file = result_path(&app.handle(), "project-1", "schedule-1").unwrap();
    store(&app, &task("page-audit"));
    let register_calls = Arc::new(AtomicUsize::new(0));
    let seen_registers = register_calls.clone();
    let result = run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        move |_| {
            let mut mismatched = task("page-audit");
            mismatched.schedule_id = "schedule-2".into();
            write_json_atomic(
                &path,
                &serde_json::to_value(mismatched).unwrap(),
                MAX_EXECUTION_BYTES,
            )
            .unwrap();
            async { Ok(Value::Null) }
        },
        move |_, _, _, _| {
            seen_registers.fetch_add(1, Ordering::SeqCst);
            Ok(())
        },
        |_, _| Ok(()),
    )
    .await;
    assert_eq!(
        result.unwrap_err(),
        "Scheduled task manifest does not match requested schedule."
    );
    assert_eq!(register_calls.load(Ordering::SeqCst), 0);
    assert!(!metadata_path.exists());
    assert!(!result_file.exists());
}
