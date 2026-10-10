use super::*;
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

fn fixture() -> StorageApp {
    StorageApp::new(mock_builder().invoke_handler(tauri::generate_handler![
        save_scheduled_task,
        delete_scheduled_task,
        load_scheduled_execution,
        list_scheduled_executions,
        acknowledge_scheduled_execution
    ]))
}

fn handoff(schedule: &str, succeeded: bool) -> ScheduledExecutionHandoff {
    ScheduledExecutionHandoff {
        project_id: "project-1".into(),
        schedule_id: schedule.into(),
        task_type: "page-audit".into(),
        started_at: "2026-09-25T02:00:00Z".into(),
        completed_at: "2026-09-25T03:00:00Z".into(),
        succeeded,
        next_run_at: "2026-09-26T03:00:00Z".into(),
        error: None,
        scheduler_error: None,
        result: None,
    }
}

fn store(app: &StorageApp, value: &ScheduledExecutionHandoff) {
    write_json_atomic(
        &execution_path(&app.handle(), "project-1", &value.schedule_id).unwrap(),
        &serde_json::to_value(value).unwrap(),
        MAX_EXECUTION_BYTES,
    )
    .unwrap();
}

mod filename_edges;
mod identity;
mod ipc;
mod listing;
mod persistence;
