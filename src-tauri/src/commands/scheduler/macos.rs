use super::{
    plist::launchd_plist,
    shared::{current_executable, queue_task_name, task_name},
    time::scheduler_time,
};
use std::{env, fs, path::PathBuf, process::Command};

pub(super) fn register_platform(
    project_id: &str,
    schedule_id: &str,
    next_run_at: &str,
    queue: bool,
) -> Result<String, String> {
    let home = env::var_os("HOME").ok_or("Unable to resolve the macOS home directory.")?;
    let launch_agents = PathBuf::from(home).join("Library/LaunchAgents");
    fs::create_dir_all(&launch_agents)
        .map_err(|error| format!("Unable to create macOS LaunchAgents directory: {error}"))?;
    let label = if queue {
        queue_task_name(project_id, schedule_id)
    } else {
        task_name(project_id, schedule_id)
    };
    let plist_path = launch_agents.join(format!("{label}.plist"));
    let executable = current_executable()?;
    let trigger = scheduler_time(next_run_at)?;
    let plist = launchd_plist(&label, &executable, trigger, project_id, schedule_id, queue);
    fs::write(&plist_path, plist)
        .map_err(|error| format!("Unable to write macOS schedule: {error}"))?;
    let uid = Command::new("id")
        .arg("-u")
        .output()
        .map_err(|error| format!("Unable to resolve macOS user id: {error}"))?;
    if !uid.status.success() {
        return Err("Unable to resolve macOS user id.".into());
    }
    let uid = String::from_utf8_lossy(&uid.stdout).trim().to_string();
    if !uid.bytes().all(|byte| byte.is_ascii_digit()) || uid.is_empty() {
        return Err("Invalid macOS user id.".into());
    }
    let domain = format!("gui/{uid}");
    let _ = Command::new("launchctl")
        .args(["bootout", &format!("{domain}/{label}")])
        .status();
    let status = Command::new("launchctl")
        .args(["bootstrap", &domain, &plist_path.to_string_lossy()])
        .status()
        .map_err(|error| format!("Unable to register macOS schedule: {error}"))?;
    if !status.success() {
        return Err("macOS launchd rejected the SEOmi schedule.".into());
    }
    Ok(label)
}

pub(super) fn unregister_platform(
    project_id: &str,
    schedule_id: &str,
    queue: bool,
) -> Result<(), String> {
    let home = env::var_os("HOME").ok_or("Unable to resolve the macOS home directory.")?;
    let label = if queue {
        queue_task_name(project_id, schedule_id)
    } else {
        task_name(project_id, schedule_id)
    };
    let uid = Command::new("id")
        .arg("-u")
        .output()
        .map_err(|error| format!("Unable to resolve macOS user id: {error}"))?;
    let uid = String::from_utf8_lossy(&uid.stdout).trim().to_string();
    if !uid.bytes().all(|byte| byte.is_ascii_digit()) || uid.is_empty() {
        return Err("Invalid macOS user id.".into());
    }
    let domain = format!("gui/{uid}");
    let _ = Command::new("launchctl")
        .args(["bootout", &format!("{domain}/{label}")])
        .status();
    let plist_path = PathBuf::from(home)
        .join("Library/LaunchAgents")
        .join(format!("{label}.plist"));
    if plist_path.exists() {
        fs::remove_file(plist_path)
            .map_err(|error| format!("Unable to remove macOS schedule: {error}"))?;
    }
    Ok(())
}
