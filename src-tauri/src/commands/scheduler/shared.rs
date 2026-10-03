use std::{env, path::PathBuf};

pub(super) fn task_name(project_id: &str, schedule_id: &str) -> String {
    format!("seomi-audit-{project_id}-{schedule_id}")
}

pub(super) fn queue_task_name(project_id: &str, run_id: &str) -> String {
    format!("seomi-audit-queue-{project_id}-{run_id}")
}

pub(super) fn current_executable() -> Result<PathBuf, String> {
    let executable = env::current_exe()
        .map_err(|error| format!("Unable to resolve SEOmi executable: {error}"))?;
    if executable.to_string_lossy().contains('"') {
        return Err("The SEOmi executable path contains an unsupported quote.".into());
    }
    Ok(executable)
}
