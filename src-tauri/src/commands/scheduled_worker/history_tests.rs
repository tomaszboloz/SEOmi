use super::{models::*, storage::*, tests::manifest};
use chrono::{DateTime, Duration, Utc};

fn execution(index: usize) -> ScheduledTaskExecution {
    ScheduledTaskExecution {
        started_at: "2026-09-25T02:00:00Z".into(),
        completed_at: "2026-09-25T03:00:00Z".into(),
        succeeded: false,
        error: Some(format!("error-{index}")),
    }
}

#[test]
fn history_retains_only_latest_twenty_records_in_order() {
    let mut task = manifest();
    for index in 0..21 {
        append_execution(&mut task, &execution(index));
    }
    assert_eq!(task.run_history.len(), 20);
    assert_eq!(task.run_history[0].error.as_deref(), Some("error-1"));
    assert_eq!(task.run_history[19].error.as_deref(), Some("error-20"));
    assert!(validate_manifest("project", &task).is_ok());
    task.run_history.push(execution(21));
    assert_eq!(
        validate_manifest("project", &task).unwrap_err(),
        "Scheduled task history exceeds the safety limit."
    );
}

#[test]
fn history_validates_each_timestamp_and_preserves_optional_errors() {
    for field in [0, 1] {
        let mut task = manifest();
        let mut entry = execution(0);
        if field == 0 {
            entry.started_at = "bad".into();
        } else {
            entry.completed_at = "bad".into();
        }
        task.run_history.push(entry);
        assert_eq!(
            validate_manifest("project", &task).unwrap_err(),
            "Scheduled task history contains an invalid entry."
        );
    }
    let mut task = manifest();
    let mut entry = execution(0);
    entry.error = None;
    task.run_history.push(entry);
    assert!(validate_manifest("project", &task).is_ok());
}

#[test]
fn due_guard_checks_exact_grace_boundary_timezone_and_invalid_input() {
    let now = DateTime::parse_from_rfc3339("2026-09-25T03:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    for seconds in [-1, 0, 90] {
        assert!(now_is_due(&(now + Duration::seconds(seconds)).to_rfc3339(), now).unwrap());
    }
    assert!(!now_is_due(&(now + Duration::seconds(91)).to_rfc3339(), now).unwrap());
    assert!(now_is_due("2026-09-25T05:00:00+02:00", now).unwrap());
    assert_eq!(
        now_is_due("bad", now).unwrap_err(),
        "Scheduled task next run must be an RFC3339 timestamp."
    );
}

#[test]
fn finalization_preserves_errors_and_invalid_completion_does_not_mutate_task() {
    for enabled in [true, false] {
        let mut task = manifest();
        task.enabled = enabled;
        let next = finalize_task(&mut task, execution(7), false).unwrap();
        assert_eq!(task.status, if enabled { "failed" } else { "paused" });
        assert_eq!(task.last_error.as_deref(), Some("error-7"));
        assert_eq!(task.last_run_at.as_deref(), Some("2026-09-25T03:00:00Z"));
        assert_eq!(next, "2026-09-26T03:00:00+00:00");
        assert_eq!(task.next_run_at, next);
    }
    let mut task = manifest();
    let before = serde_json::to_value(&task).unwrap();
    let mut entry = execution(0);
    entry.completed_at = "bad".into();
    assert_eq!(
        finalize_task(&mut task, entry, false).unwrap_err(),
        "Scheduled task completion time must be an RFC3339 timestamp."
    );
    assert_eq!(serde_json::to_value(task).unwrap(), before);
}

#[test]
fn delivery_fingerprint_is_stable_and_changes_with_every_identity_part() {
    let base = ScheduledExecutionHandoff {
        project_id: "p".into(),
        schedule_id: "s".into(),
        task_type: "page-audit".into(),
        started_at: "2026-09-25T02:00:00Z".into(),
        completed_at: "2026-09-25T03:00:00Z".into(),
        succeeded: true,
        next_run_at: "2026-09-26T03:00:00Z".into(),
        error: None,
        scheduler_error: None,
        result: None,
        fingerprint: None,
    };
    let fingerprint = base.fingerprint_of();
    assert_eq!(fingerprint.len(), 64);
    assert_eq!(fingerprint, base.fingerprint_of());
    let mut later = base.clone();
    later.next_run_at = "2030-01-01T00:00:00Z".into();
    later.error = Some("ignored".into());
    assert_eq!(
        later.fingerprint_of(),
        fingerprint,
        "next run and error text are not identity"
    );
    let changes: [fn(&mut ScheduledExecutionHandoff); 6] = [
        |h| h.project_id = "q".into(),
        |h| h.schedule_id = "t".into(),
        |h| h.task_type = "site-crawl".into(),
        |h| h.started_at = "2026-09-25T02:00:01Z".into(),
        |h| h.completed_at = "2026-09-25T03:00:01Z".into(),
        |h| h.succeeded = false,
    ];
    for change in changes {
        let mut other = base.clone();
        change(&mut other);
        assert_ne!(other.fingerprint_of(), fingerprint);
    }
    let wire = serde_json::to_value(&base).unwrap();
    assert!(wire.get("fingerprint").is_none());
    let mut stamped = base;
    stamped.fingerprint = Some(fingerprint.clone());
    assert_eq!(
        serde_json::to_value(&stamped).unwrap()["fingerprint"],
        fingerprint
    );
}
