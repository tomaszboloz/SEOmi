use super::{
    shared::{current_executable, queue_task_name, task_name},
    time::scheduler_time,
};
use std::process::Command;

pub(super) fn register_platform(
    project_id: &str,
    schedule_id: &str,
    next_run_at: &str,
    queue: bool,
) -> Result<String, String> {
    let label = if queue {
        queue_task_name(project_id, schedule_id)
    } else {
        task_name(project_id, schedule_id)
    };
    let executable = current_executable()?;
    let trigger = scheduler_time(next_run_at)?;
    let launch_flag = if queue {
        "--seomi-audit-queue-headless"
    } else {
        "--seomi-scheduled-headless"
    };
    let task_run = format!(
        "\"{}\" {launch_flag} --seomi-scheduled-project {} --seomi-scheduled-id {}",
        executable.display(),
        project_id,
        schedule_id
    );
    let start_date = format!(
        "{:02}/{:02}/{:04}",
        trigger.month, trigger.day, trigger.year
    );
    let start_time = format!("{:02}:{:02}", trigger.hour, trigger.minute);
    let status = Command::new("schtasks")
        .args([
            "/Create",
            "/F",
            "/TN",
            &label,
            "/TR",
            &task_run,
            "/SC",
            "ONCE",
            "/SD",
            &start_date,
            "/ST",
            &start_time,
        ])
        .status()
        .map_err(|error| format!("Unable to register Windows Task Scheduler job: {error}"))?;
    if !status.success() {
        return Err("Windows Task Scheduler rejected the SEOmi schedule.".into());
    }
    Ok(label)
}

pub(super) fn unregister_platform(
    project_id: &str,
    schedule_id: &str,
    queue: bool,
) -> Result<(), String> {
    let label = if queue {
        queue_task_name(project_id, schedule_id)
    } else {
        task_name(project_id, schedule_id)
    };
    let status = Command::new("schtasks")
        .args(["/Delete", "/F", "/TN", &label])
        .status()
        .map_err(|error| format!("Unable to remove Windows Task Scheduler job: {error}"))?;
    if !status.success() {
        return Err("Windows Task Scheduler rejected removal of the SEOmi schedule.".into());
    }
    Ok(())
}
