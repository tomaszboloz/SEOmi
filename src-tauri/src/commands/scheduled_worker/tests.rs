use super::models::{validate_manifest, ScheduledTaskExecution, ScheduledTaskManifest};
use super::storage::{finalize_task, now_is_due};
use chrono::{Duration as ChronoDuration, Utc};

pub(super) fn manifest() -> ScheduledTaskManifest {
    ScheduledTaskManifest {
        schedule_id: "schedule-1".into(),
        url: "https://example.test".into(),
        task_type: "page-audit".into(),
        crawl_limit: None,
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

#[test]
fn manifest_rejects_credentials_and_invalid_intervals() {
    let mut value = manifest();
    value.url = "https://user:pass@example.test".into();
    assert!(validate_manifest("project-1", &value).is_err());
    value.url = "https://example.test".into();
    value.interval_hours = 1;
    assert!(validate_manifest("project-1", &value).is_err());
}

#[test]
fn manifest_rejects_invalid_execution_timestamps_and_unbounded_errors() {
    let mut value = manifest();
    value.created_at = "not-a-date".into();
    assert!(validate_manifest("project-1", &value).is_err());

    value = manifest();
    value.run_history.push(ScheduledTaskExecution {
        started_at: "2026-09-25T00:00:00Z".into(),
        completed_at: "not-a-date".into(),
        succeeded: false,
        error: Some("x".repeat(501)),
    });
    assert!(validate_manifest("project-1", &value).is_err());
}

#[test]
fn manifest_uses_camel_case_for_frontend_handoff() {
    let value = serde_json::to_value(manifest()).expect("manifest should serialize");
    assert!(value.get("scheduleId").is_some());
    assert!(value.get("nextRunAt").is_some());
    assert!(value.get("schedule_id").is_none());
}

#[test]
fn due_guard_allows_small_scheduler_early_wakeup_only() {
    let now = Utc::now();
    assert!(now_is_due(&(now + ChronoDuration::seconds(30)).to_rfc3339(), now).unwrap());
    assert!(!now_is_due(&(now + ChronoDuration::seconds(91)).to_rfc3339(), now).unwrap());
}

#[test]
fn finalizing_enabled_task_uses_its_current_interval_and_records_history() {
    let mut value = manifest();
    value.interval_hours = 6;
    let execution = ScheduledTaskExecution {
        started_at: "2026-09-25T02:00:00Z".into(),
        completed_at: "2026-09-25T03:00:00Z".into(),
        succeeded: true,
        error: None,
    };

    let next = finalize_task(&mut value, execution, true).expect("valid test timestamp");

    assert_eq!(value.status, "completed");
    assert_eq!(next, "2026-09-25T09:00:00+00:00");
    assert_eq!(value.next_run_at, next);
    assert_eq!(value.run_history.len(), 1);
    assert!(value.last_error.is_none());
}

#[test]
fn finalizing_paused_task_never_rearms_it_as_completed() {
    let mut value = manifest();
    value.enabled = false;
    value.status = "paused".into();
    let execution = ScheduledTaskExecution {
        started_at: "2026-09-25T02:00:00Z".into(),
        completed_at: "2026-09-25T03:00:00Z".into(),
        succeeded: true,
        error: None,
    };

    finalize_task(&mut value, execution, true).expect("valid test timestamp");

    assert_eq!(value.status, "paused");
    assert!(!value.enabled);
    assert_eq!(value.run_history.len(), 1);
}
