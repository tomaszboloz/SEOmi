use super::super::{models::*, storage::*};
use crate::utils::test_app::StorageApp;
use serde_json::Value;
use tauri::test::mock_builder;

mod cancellation_and_corrupt_tests;
mod dispatcher;
mod execution_runner_coverage_tests;
mod execution_runner_outcome_tests;
mod identity;
mod io_failures;
mod production_dispatch;
mod runner_guards;
mod runner_outcomes;

fn fixture() -> StorageApp {
    StorageApp::new(mock_builder())
}

fn task(task_type: &str) -> ScheduledTaskManifest {
    ScheduledTaskManifest {
        schedule_id: "schedule-1".into(),
        url: "https://example.test".into(),
        task_type: task_type.into(),
        crawl_limit: Some(3),
        crawl_config: None,
        interval_hours: 24,
        enabled: true,
        status: "scheduled".into(),
        created_at: "2026-09-25T00:00:00Z".into(),
        next_run_at: "2026-09-25T01:00:00Z".into(),
        last_started_at: None,
        last_run_at: None,
        last_error: None,
        run_history: Vec::new(),
    }
}

fn store(app: &StorageApp, task: &ScheduledTaskManifest) {
    write_json_atomic(
        &task_path(&app.handle(), "project-1", &task.schedule_id).unwrap(),
        &serde_json::to_value(task).unwrap(),
        MAX_EXECUTION_BYTES,
    )
    .unwrap();
}

fn read_task(app: &StorageApp, schedule: &str) -> ScheduledTaskManifest {
    read_json(
        &task_path(&app.handle(), "project-1", schedule).unwrap(),
        MAX_EXECUTION_BYTES,
    )
    .unwrap()
    .unwrap()
}

fn read_value(app: &StorageApp, schedule: &str) -> Value {
    read_json(
        &execution_path(&app.handle(), "project-1", schedule).unwrap(),
        MAX_EXECUTION_BYTES,
    )
    .unwrap()
    .unwrap()
}
