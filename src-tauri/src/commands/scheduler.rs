use chrono::{Datelike, Timelike};
use serde::Serialize;
use std::env;
#[cfg(target_os = "macos")]
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct SchedulerTime {
    year: i32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
}

const MAX_IDENTIFIER_LENGTH: usize = 80;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchedulerRegistration {
    pub platform: String,
    pub task_name: String,
    pub next_run_at: String,
    pub interval_hours: u32,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledLaunchContext {
    pub project_id: Option<String>,
    pub schedule_id: Option<String>,
    pub headless: bool,
}

fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_IDENTIFIER_LENGTH
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn validate_schedule_args(
    project_id: &str,
    schedule_id: &str,
    next_run_at: &str,
    interval_hours: u32,
) -> Result<(), String> {
    if !valid_identifier(project_id) || !valid_identifier(schedule_id) {
        return Err("Invalid project or schedule identifier.".into());
    }
    if !matches!(interval_hours, 6 | 12 | 24 | 168) {
        return Err("Unsupported audit schedule interval.".into());
    }
    chrono::DateTime::parse_from_rfc3339(next_run_at)
        .map(|_| ())
        .map_err(|_| "Schedule next run must be an RFC3339 timestamp.".into())
}

/// Convert the persisted UTC/RFC3339 deadline to a local, minute-granularity
/// trigger understood by launchd and Task Scheduler. Both OS schedulers may
/// start a process a few seconds early when seconds cannot be represented, so
/// round forward and let the app's due-time check provide the final guard.
fn ceil_to_minute(value: chrono::DateTime<chrono::Local>) -> chrono::DateTime<chrono::Local> {
    let minute = value
        .with_second(0)
        .and_then(|value| value.with_nanosecond(0))
        .expect("a valid local time can always be normalized to a minute");
    if value == minute {
        minute
    } else {
        minute + chrono::Duration::minutes(1)
    }
}

fn scheduler_time_at(
    next_run_at: &str,
    now: chrono::DateTime<chrono::Local>,
) -> Result<SchedulerTime, String> {
    let parsed = chrono::DateTime::parse_from_rfc3339(next_run_at)
        .map_err(|_| "Schedule next run must be an RFC3339 timestamp.".to_string())?;
    let local = parsed.with_timezone(&chrono::Local);
    let rounded = ceil_to_minute(local);
    let rounded = if rounded <= now {
        ceil_to_minute(now + chrono::Duration::seconds(1))
    } else {
        rounded
    };
    Ok(SchedulerTime {
        year: rounded.year(),
        month: rounded.month(),
        day: rounded.day(),
        hour: rounded.hour(),
        minute: rounded.minute(),
    })
}

fn scheduler_time(next_run_at: &str) -> Result<SchedulerTime, String> {
    scheduler_time_at(next_run_at, chrono::Local::now())
}

fn task_name(project_id: &str, schedule_id: &str) -> String {
    format!("seomi-audit-{project_id}-{schedule_id}")
}

fn queue_task_name(project_id: &str, run_id: &str) -> String {
    format!("seomi-audit-queue-{project_id}-{run_id}")
}

#[cfg(target_os = "macos")]
fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn current_executable() -> Result<PathBuf, String> {
    let executable = env::current_exe()
        .map_err(|error| format!("Unable to resolve SEOmi executable: {error}"))?;
    if executable.to_string_lossy().contains('"') {
        return Err("The SEOmi executable path contains an unsupported quote.".into());
    }
    Ok(executable)
}

#[cfg(target_os = "macos")]
fn register_platform(
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
    let executable = escape_xml(&executable.to_string_lossy());
    let trigger = scheduler_time(next_run_at)?;
    let project = escape_xml(project_id);
    let schedule = escape_xml(schedule_id);
    let launch_flag = if queue {
        "--seomi-audit-queue-headless"
    } else {
        "--seomi-scheduled-headless"
    };
    let plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>{label}</string>
<key>ProgramArguments</key><array><string>{executable}</string><string>{launch_flag}</string><string>--seomi-scheduled-project</string><string>{project}</string><string>--seomi-scheduled-id</string><string>{schedule}</string></array>
<key>RunAtLoad</key><false/>
<key>StartCalendarInterval</key><dict>
<key>Year</key><integer>{year}</integer>
<key>Month</key><integer>{month}</integer>
<key>Day</key><integer>{day}</integer>
<key>Hour</key><integer>{hour}</integer>
<key>Minute</key><integer>{minute}</integer>
</dict>
<key>ProcessType</key><string>Background</string>
</dict></plist>
"#,
        year = trigger.year,
        month = trigger.month,
        day = trigger.day,
        hour = trigger.hour,
        minute = trigger.minute,
    );
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

#[cfg(target_os = "windows")]
fn register_platform(
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

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn register_platform(
    _project_id: &str,
    _schedule_id: &str,
    _next_run_at: &str,
    _queue: bool,
) -> Result<String, String> {
    Err("OS audit scheduling is available only in the macOS and Windows desktop builds.".into())
}

#[cfg(target_os = "macos")]
fn unregister_platform(project_id: &str, schedule_id: &str, queue: bool) -> Result<(), String> {
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

#[cfg(target_os = "windows")]
fn unregister_platform(project_id: &str, schedule_id: &str, queue: bool) -> Result<(), String> {
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

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn unregister_platform(_project_id: &str, _schedule_id: &str, _queue: bool) -> Result<(), String> {
    Err("OS audit scheduling is available only in the macOS and Windows desktop builds.".into())
}

#[tauri::command]
pub fn register_audit_wakeup(
    project_id: String,
    schedule_id: String,
    next_run_at: String,
    interval_hours: u32,
) -> Result<SchedulerRegistration, String> {
    validate_schedule_args(&project_id, &schedule_id, &next_run_at, interval_hours)?;
    let task_name = register_platform(&project_id, &schedule_id, &next_run_at, false)?;
    Ok(SchedulerRegistration {
        platform: if cfg!(target_os = "macos") {
            "macos".into()
        } else {
            "windows".into()
        },
        task_name,
        next_run_at,
        interval_hours,
    })
}

#[tauri::command]
pub fn unregister_audit_wakeup(project_id: String, schedule_id: String) -> Result<(), String> {
    if !valid_identifier(&project_id) || !valid_identifier(&schedule_id) {
        return Err("Invalid project or schedule identifier.".into());
    }
    unregister_platform(&project_id, &schedule_id, false)
}

/// Register a one-shot wake-up for a persisted CSV/page-audit queue. The
/// queue worker uses a distinct task name and launch flag so it cannot be
/// confused with a recurring project schedule.
#[tauri::command]
pub fn register_audit_queue_wakeup(
    project_id: String,
    run_id: String,
    next_run_at: String,
) -> Result<SchedulerRegistration, String> {
    if !valid_identifier(&project_id) || !valid_identifier(&run_id) {
        return Err("Invalid project or queue run identifier.".into());
    }
    chrono::DateTime::parse_from_rfc3339(&next_run_at)
        .map_err(|_| "Queue wake-up must be an RFC3339 timestamp.")?;
    let task_name = register_platform(&project_id, &run_id, &next_run_at, true)?;
    Ok(SchedulerRegistration {
        platform: if cfg!(target_os = "macos") {
            "macos".into()
        } else {
            "windows".into()
        },
        task_name,
        next_run_at,
        interval_hours: 0,
    })
}

#[tauri::command]
pub fn unregister_audit_queue_wakeup(project_id: String, run_id: String) -> Result<(), String> {
    if !valid_identifier(&project_id) || !valid_identifier(&run_id) {
        return Err("Invalid project or queue run identifier.".into());
    }
    unregister_platform(&project_id, &run_id, true)
}

#[tauri::command]
pub fn scheduled_launch_context() -> ScheduledLaunchContext {
    let args = env::args().collect::<Vec<_>>();
    let value_after = |flag: &str| {
        args.windows(2)
            .find(|pair| pair[0] == flag)
            .map(|pair| pair[1].clone())
            .filter(|value| valid_identifier(value))
    };
    ScheduledLaunchContext {
        project_id: value_after("--seomi-scheduled-project"),
        schedule_id: value_after("--seomi-scheduled-id"),
        headless: args
            .iter()
            .any(|value| value == "--seomi-scheduled-headless"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn schedule_arguments_are_strictly_scoped() {
        assert!(
            validate_schedule_args("project-1", "schedule-1", "2026-09-24T10:00:00Z", 6).is_ok()
        );
        assert!(
            validate_schedule_args("project/1", "schedule-1", "2026-09-24T10:00:00Z", 6).is_err()
        );
        assert!(
            validate_schedule_args("project-1", "schedule-1", "2026-09-24T10:00:00Z", 1).is_err()
        );
        assert!(validate_schedule_args("project-1", "schedule-1", "not-a-date", 6).is_err());
    }

    #[test]
    fn task_name_contains_no_user_url_or_secret() {
        assert_eq!(
            task_name("project-1", "schedule-2"),
            "seomi-audit-project-1-schedule-2"
        );
    }

    #[test]
    fn legacy_identifiers_with_underscores_share_the_manifest_contract() {
        assert!(validate_schedule_args(
            "project_legacy_1",
            "schedule_legacy_1",
            "2026-09-24T10:00:00Z",
            24,
        )
        .is_ok());
    }

    #[test]
    fn scheduler_trigger_is_local_and_minute_aligned() {
        let now = chrono::Local::now();
        let target = now + chrono::Duration::days(3) + chrono::Duration::seconds(17);
        let value = target.to_rfc3339();
        let trigger = scheduler_time_at(&value, now).expect("valid schedule should parse");
        let expected = ceil_to_minute(target);
        assert_eq!(
            (
                trigger.year,
                trigger.month,
                trigger.day,
                trigger.hour,
                trigger.minute
            ),
            (
                expected.year(),
                expected.month(),
                expected.day(),
                expected.hour(),
                expected.minute()
            ),
        );
    }

    #[test]
    fn overdue_trigger_is_moved_to_a_future_minute() {
        let now = chrono::Local::now();
        let value = (now - chrono::Duration::hours(1)).to_rfc3339();
        let trigger = scheduler_time_at(&value, now).expect("valid schedule should parse");
        let trigger_at = chrono::Local
            .with_ymd_and_hms(
                trigger.year,
                trigger.month,
                trigger.day,
                trigger.hour,
                trigger.minute,
                0,
            )
            .single()
            .expect("calendar components should be valid");
        assert!(trigger_at > now);
    }

    #[test]
    fn scheduler_trigger_rejects_invalid_timestamp() {
        assert!(scheduler_time("not-a-date").is_err());
    }
    #[test]
    fn public_recurring_commands_reject_invalid_identifiers_before_os_mutation() {
        for (project, schedule) in [
            ("../project", "schedule"),
            ("project", "../schedule"),
            ("", "schedule"),
        ] {
            assert!(register_audit_wakeup(
                project.into(),
                schedule.into(),
                "2026-10-01T12:00:00Z".into(),
                24
            )
            .is_err());
            assert!(unregister_audit_wakeup(project.into(), schedule.into()).is_err());
        }
    }

    #[test]
    fn public_recurring_command_rejects_bad_time_and_interval_before_os_mutation() {
        assert!(
            register_audit_wakeup("project".into(), "schedule".into(), "invalid".into(), 24)
                .is_err()
        );
        assert!(register_audit_wakeup(
            "project".into(),
            "schedule".into(),
            "2026-10-01T12:00:00Z".into(),
            1
        )
        .is_err());
    }

    #[test]
    fn public_queue_commands_reject_invalid_identity_and_deadline_before_os_mutation() {
        for (project, run) in [
            ("../project", "run"),
            ("project", "../run"),
            ("project", ""),
        ] {
            assert!(register_audit_queue_wakeup(
                project.into(),
                run.into(),
                "2026-10-01T12:00:00Z".into()
            )
            .is_err());
            assert!(unregister_audit_queue_wakeup(project.into(), run.into()).is_err());
        }
        assert!(
            register_audit_queue_wakeup("project".into(), "run".into(), "invalid".into()).is_err()
        );
    }

    #[test]
    fn public_launch_context_has_no_schedule_without_scheduler_flags() {
        let context = scheduled_launch_context();
        assert!(context.project_id.is_none());
        assert!(context.schedule_id.is_none());
        assert!(!context.headless);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn plist_arguments_escape_all_xml_metacharacters() {
        assert_eq!(
            escape_xml("a&b<c>d\"e'f"),
            "a&amp;b&lt;c&gt;d&quot;e&apos;f"
        );
        assert_eq!(escape_xml("simple/path"), "simple/path");
    }
}
