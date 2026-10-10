use super::{valid_identifier, validate_schedule_args, SchedulerRegistration};

pub(super) fn register_audit_wakeup_with(
    project_id: String,
    schedule_id: String,
    next_run_at: String,
    interval_hours: u32,
    register: impl FnOnce(&str, &str, &str, bool) -> Result<String, String>,
) -> Result<SchedulerRegistration, String> {
    validate_schedule_args(&project_id, &schedule_id, &next_run_at, interval_hours)?;
    let task_name = register(&project_id, &schedule_id, &next_run_at, false)?;
    Ok(registration(task_name, next_run_at, interval_hours))
}

pub(super) fn register_audit_queue_wakeup_with(
    project_id: String,
    run_id: String,
    next_run_at: String,
    register: impl FnOnce(&str, &str, &str, bool) -> Result<String, String>,
) -> Result<SchedulerRegistration, String> {
    if !valid_identifier(&project_id) || !valid_identifier(&run_id) {
        return Err("Invalid project or queue run identifier.".into());
    }
    chrono::DateTime::parse_from_rfc3339(&next_run_at)
        .map_err(|_| "Queue wake-up must be an RFC3339 timestamp.")?;
    let task_name = register(&project_id, &run_id, &next_run_at, true)?;
    Ok(registration(task_name, next_run_at, 0))
}

fn registration(
    task_name: String,
    next_run_at: String,
    interval_hours: u32,
) -> SchedulerRegistration {
    SchedulerRegistration {
        platform: if cfg!(target_os = "macos") {
            "macos"
        } else {
            "windows"
        }
        .into(),
        task_name,
        next_run_at,
        interval_hours,
    }
}

pub(super) fn unregister_audit_wakeup_with(
    project_id: &str,
    schedule_id: &str,
    unregister: impl FnOnce(&str, &str, bool) -> Result<(), String>,
) -> Result<(), String> {
    if !valid_identifier(project_id) || !valid_identifier(schedule_id) {
        return Err("Invalid project or schedule identifier.".into());
    }
    unregister(project_id, schedule_id, false)
}

pub(super) fn unregister_audit_queue_wakeup_with(
    project_id: &str,
    run_id: &str,
    unregister: impl FnOnce(&str, &str, bool) -> Result<(), String>,
) -> Result<(), String> {
    if !valid_identifier(project_id) || !valid_identifier(run_id) {
        return Err("Invalid project or queue run identifier.".into());
    }
    unregister(project_id, run_id, true)
}

#[cfg(test)]
#[path = "forwarding_error_tests.rs"]
mod error_tests;
#[cfg(test)]
#[path = "command_forwarding_tests.rs"]
mod tests;
