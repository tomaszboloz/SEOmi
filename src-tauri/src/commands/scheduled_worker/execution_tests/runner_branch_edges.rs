use super::super::super::models::{ScheduledTaskManifest, MAX_EXECUTION_BYTES};
use super::super::super::storage::{task_path, write_json_atomic};
use super::super::runner::run_scheduled_task_with;
use super::{fixture, store, task, StorageApp};
use serde_json::Value;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};

fn p_task(app: &StorageApp) -> std::path::PathBuf {
    task_path(&app.handle(), "project-1", "schedule-1").unwrap()
}
fn write_task(app: &StorageApp, t: &ScheduledTaskManifest) {
    write_json_atomic(
        &p_task(app),
        &serde_json::to_value(t).unwrap(),
        MAX_EXECUTION_BYTES,
    )
    .unwrap();
}
fn ok_reg(_: String, _: String, _: String, _: u32) -> Result<(), String> {
    Ok(())
}
fn ok_unreg(_: String, _: String) -> Result<(), String> {
    Ok(())
}
fn no_run(_: ScheduledTaskManifest) -> std::future::Ready<Result<Value, String>> {
    panic!("must not execute")
}

fn run_t<E, R, U, F>(
    app: &StorageApp,
    e: E,
    r: R,
    u: U,
) -> impl std::future::Future<Output = Result<(), String>>
where
    E: Fn(ScheduledTaskManifest) -> F,
    F: std::future::Future<Output = Result<Value, String>>,
    R: Fn(String, String, String, u32) -> Result<(), String>,
    U: Fn(String, String) -> Result<(), String>,
{
    run_scheduled_task_with(
        app.handle(),
        "project-1".into(),
        "schedule-1".into(),
        e,
        r,
        u,
    )
}

#[path = "runner_branch_edges_part1.rs"]
mod part1;
#[path = "runner_branch_edges_part2.rs"]
mod part2;
