use crate::commands::site_crawler;
use crate::utils::url_validator::validate_and_normalize_url;
use chrono::DateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub(super) const MAX_IDENTIFIER_LENGTH: usize = 80;
pub(super) const MAX_RESULT_BYTES: usize = 256 * 1024 * 1024;
pub(super) const MAX_EXECUTION_BYTES: usize = 256 * 1024;
pub(super) const SCHEDULE_GRACE_SECONDS: i64 = 90;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskManifest {
    pub schedule_id: String,
    pub url: String,
    pub task_type: String,
    #[serde(default)]
    pub crawl_limit: Option<usize>,
    #[serde(default)]
    pub crawl_config: Option<site_crawler::CrawlConfig>,
    pub interval_hours: u32,
    pub enabled: bool,
    pub status: String,
    pub created_at: String,
    pub next_run_at: String,
    #[serde(default)]
    pub last_started_at: Option<String>,
    #[serde(default)]
    pub last_run_at: Option<String>,
    #[serde(default)]
    pub last_error: Option<String>,
    #[serde(default)]
    pub run_history: Vec<ScheduledTaskExecution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskExecution {
    pub started_at: String,
    pub completed_at: String,
    pub succeeded: bool,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledExecutionHandoff {
    pub project_id: String,
    pub schedule_id: String,
    pub task_type: String,
    pub started_at: String,
    pub completed_at: String,
    pub succeeded: bool,
    pub next_run_at: String,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub scheduler_error: Option<String>,
    #[serde(default)]
    pub result: Option<Value>,
}

pub(super) fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_IDENTIFIER_LENGTH
        && value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

pub(super) fn validate_project_and_schedule(project_id: &str, schedule_id: &str) -> Result<(), String> {
    if !valid_identifier(project_id) || !valid_identifier(schedule_id) {
        return Err("Invalid project or schedule identifier.".into());
    }
    Ok(())
}

pub(super) fn validate_manifest(project_id: &str, task: &ScheduledTaskManifest) -> Result<(), String> {
    validate_project_and_schedule(project_id, &task.schedule_id)?;
    if !matches!(task.task_type.as_str(), "page-audit" | "site-crawl") {
        return Err("Unsupported scheduled task type.".into());
    }
    if !matches!(task.interval_hours, 6 | 12 | 24 | 168) {
        return Err("Unsupported scheduled task interval.".into());
    }
    if !matches!(task.status.as_str(), "scheduled" | "running" | "completed" | "failed" | "paused") {
        return Err("Unsupported scheduled task status.".into());
    }
    let normalized = validate_and_normalize_url(&task.url)
        .map_err(|e| format!("Invalid scheduled URL: {e}"))?;
    if normalized.username() != "" || normalized.password().is_some() {
        return Err("Scheduled URL cannot contain credentials.".into());
    }
    if task.task_type == "site-crawl" {
        let limit = task.crawl_limit.unwrap_or(25);
        if !(1..=500).contains(&limit) {
            return Err("Scheduled crawl limit must be between 1 and 500 pages.".into());
        }
    }
    DateTime::parse_from_rfc3339(&task.next_run_at)
        .map_err(|_| "Scheduled task next run must be an RFC3339 timestamp.".to_string())?;
    DateTime::parse_from_rfc3339(&task.created_at)
        .map_err(|_| "Scheduled task creation time must be an RFC3339 timestamp.".to_string())?;
    for value in [task.last_started_at.as_deref(), task.last_run_at.as_deref()].into_iter().flatten() {
        DateTime::parse_from_rfc3339(value)
            .map_err(|_| "Scheduled task history time must be an RFC3339 timestamp.")?;
    }
    if task.run_history.len() > 20 {
        return Err("Scheduled task history exceeds the safety limit.".into());
    }
    if task.run_history.iter().any(|e| {
        DateTime::parse_from_rfc3339(&e.started_at).is_err()
            || DateTime::parse_from_rfc3339(&e.completed_at).is_err()
            || e.error.as_deref().is_some_and(|err| err.len() > 500)
    }) {
        return Err("Scheduled task history contains an invalid entry.".into());
    }
    Ok(())
}
