use super::{
    plist::launchd_plist,
    process::{ProcessRunner, SystemProcessRunner},
    shared::{current_executable, queue_task_name, task_name},
    time::scheduler_time,
};
use std::{
    env, fs,
    path::{Path, PathBuf},
};

pub(super) fn register_platform(
    project_id: &str,
    schedule_id: &str,
    next_run_at: &str,
    queue: bool,
) -> Result<String, String> {
    let home =
        PathBuf::from(env::var_os("HOME").ok_or("Unable to resolve the macOS home directory.")?);
    let executable = current_executable()?;
    register_platform_with(
        &home,
        &executable,
        project_id,
        schedule_id,
        next_run_at,
        queue,
        &SystemProcessRunner,
    )
}

fn register_platform_with<R: ProcessRunner>(
    home: &Path,
    executable: &Path,
    project_id: &str,
    schedule_id: &str,
    next_run_at: &str,
    queue: bool,
    runner: &R,
) -> Result<String, String> {
    let launch_agents = home.join("Library/LaunchAgents");
    fs::create_dir_all(&launch_agents)
        .map_err(|error| format!("Unable to create macOS LaunchAgents directory: {error}"))?;
    let label = if queue {
        queue_task_name(project_id, schedule_id)
    } else {
        task_name(project_id, schedule_id)
    };
    let plist_path = launch_agents.join(format!("{label}.plist"));
    let trigger = scheduler_time(next_run_at)?;
    let plist = launchd_plist(&label, executable, trigger, project_id, schedule_id, queue);
    fs::write(&plist_path, plist)
        .map_err(|error| format!("Unable to write macOS schedule: {error}"))?;
    let uid = runner
        .output("id", &["-u".into()])
        .map_err(|error| format!("Unable to resolve macOS user id: {error}"))?;
    if !uid.success {
        return Err("Unable to resolve macOS user id.".into());
    }
    let uid = String::from_utf8_lossy(&uid.stdout).trim().to_string();
    if !uid.bytes().all(|byte| byte.is_ascii_digit()) || uid.is_empty() {
        return Err("Invalid macOS user id.".into());
    }
    let domain = format!("gui/{uid}");
    let _ = runner.status(
        "launchctl",
        &["bootout".into(), format!("{domain}/{label}")],
    );
    let status = runner
        .status(
            "launchctl",
            &[
                "bootstrap".into(),
                domain,
                plist_path.to_string_lossy().into_owned(),
            ],
        )
        .map_err(|error| format!("Unable to register macOS schedule: {error}"))?;
    if !status {
        return Err("macOS launchd rejected the SEOmi schedule.".into());
    }
    Ok(label)
}

pub(super) fn unregister_platform(
    project_id: &str,
    schedule_id: &str,
    queue: bool,
) -> Result<(), String> {
    let home =
        PathBuf::from(env::var_os("HOME").ok_or("Unable to resolve the macOS home directory.")?);
    unregister_platform_with(&home, project_id, schedule_id, queue, &SystemProcessRunner)
}

fn unregister_platform_with<R: ProcessRunner>(
    home: &Path,
    project_id: &str,
    schedule_id: &str,
    queue: bool,
    runner: &R,
) -> Result<(), String> {
    let label = if queue {
        queue_task_name(project_id, schedule_id)
    } else {
        task_name(project_id, schedule_id)
    };
    let uid = runner
        .output("id", &["-u".into()])
        .map_err(|error| format!("Unable to resolve macOS user id: {error}"))?;
    if !uid.success {
        return Err("Unable to resolve macOS user id.".into());
    }
    let uid = String::from_utf8_lossy(&uid.stdout).trim().to_string();
    if !uid.bytes().all(|byte| byte.is_ascii_digit()) || uid.is_empty() {
        return Err("Invalid macOS user id.".into());
    }
    let domain = format!("gui/{uid}");
    let _ = runner.status(
        "launchctl",
        &["bootout".into(), format!("{domain}/{label}")],
    );
    let plist_path = home
        .join("Library/LaunchAgents")
        .join(format!("{label}.plist"));
    if plist_path.exists() {
        fs::remove_file(plist_path)
            .map_err(|error| format!("Unable to remove macOS schedule: {error}"))?;
    }
    Ok(())
}

#[cfg(test)]
#[path = "macos_additional_tests.rs"]
mod additional_tests;
#[cfg(test)]
#[path = "macos_contract_tests.rs"]
mod contract_tests;
#[cfg(test)]
#[path = "macos_edge_tests.rs"]
mod edge_tests;
#[cfg(test)]
#[path = "macos_failure_tests.rs"]
mod failure_tests;
#[cfg(test)]
#[path = "macos_test_support.rs"]
mod test_support;
