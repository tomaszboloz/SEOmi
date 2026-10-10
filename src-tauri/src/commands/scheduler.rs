use std::env;
mod forwarding;
mod launch;
pub(crate) use launch::worker_launch_context;
#[cfg(target_os = "macos")]
mod macos;
mod models;
#[cfg(target_os = "macos")]
mod plist;
#[cfg(target_os = "macos")]
mod process;
mod shared;
mod time;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod unsupported;
mod validation;
#[cfg(target_os = "windows")]
mod windows;
#[cfg(test)]
use chrono::{Datelike, Timelike};
#[cfg(target_os = "macos")]
use macos::{register_platform, unregister_platform};
pub use models::{ScheduledLaunchContext, SchedulerRegistration};
#[cfg(all(test, target_os = "macos"))]
use plist::escape_xml;
#[cfg(test)]
use shared::*;
#[cfg(test)]
use time::*;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
use unsupported::{register_platform, unregister_platform};
use validation::{valid_identifier, validate_schedule_args};
#[cfg(target_os = "windows")]
use windows::{register_platform, unregister_platform};
#[cfg(test)]
mod arguments_tests;
#[cfg(test)]
mod command_tests;
#[cfg(test)]
mod contracts_tests;
#[cfg(test)]
mod forwarding_edge_tests;
#[cfg(test)]
mod launch_tests;
#[cfg(test)]
#[cfg(target_os = "macos")]
mod plist_tests;
#[cfg(test)]
mod time_tests;
#[cfg(test)]
mod worker_process_tests;

#[tauri::command]
pub fn register_audit_wakeup(
    project_id: String,
    schedule_id: String,
    next_run_at: String,
    interval_hours: u32,
) -> Result<SchedulerRegistration, String> {
    forwarding::register_audit_wakeup_with(
        project_id,
        schedule_id,
        next_run_at,
        interval_hours,
        register_platform,
    )
}
#[tauri::command]
pub fn unregister_audit_wakeup(project_id: String, schedule_id: String) -> Result<(), String> {
    forwarding::unregister_audit_wakeup_with(&project_id, &schedule_id, unregister_platform)
}
#[tauri::command]
pub fn register_audit_queue_wakeup(
    project_id: String,
    run_id: String,
    next_run_at: String,
) -> Result<SchedulerRegistration, String> {
    forwarding::register_audit_queue_wakeup_with(project_id, run_id, next_run_at, register_platform)
}
#[tauri::command]
pub fn unregister_audit_queue_wakeup(project_id: String, run_id: String) -> Result<(), String> {
    forwarding::unregister_audit_queue_wakeup_with(&project_id, &run_id, unregister_platform)
}

#[tauri::command]
pub fn scheduled_launch_context() -> ScheduledLaunchContext {
    launch::launch_context_from_args(&env::args().collect::<Vec<_>>())
}
