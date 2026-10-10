use super::{models::*, tests::manifest};

#[test]
fn execution_history_accepts_the_worker_unicode_character_limit() {
    let mut task = manifest();
    task.run_history.push(ScheduledTaskExecution {
        started_at: task.created_at.clone(),
        completed_at: task.next_run_at.clone(),
        succeeded: false,
        error: Some("ż".repeat(500)),
    });
    assert!(validate_manifest("project-1", &task).is_ok());
    task.run_history[0].error = Some("ż".repeat(501));
    assert_eq!(
        validate_manifest("project-1", &task).unwrap_err(),
        "Scheduled task history contains an invalid entry."
    );
}

#[test]
fn identifiers_enforce_ascii_boundaries_for_both_project_and_schedule() {
    for value in ["a", "Az09_-", &"x".repeat(80)] {
        assert!(valid_identifier(value));
        assert!(validate_project_and_schedule(value, "schedule").is_ok());
        assert!(validate_project_and_schedule("project", value).is_ok());
    }
    for value in ["", "../", "ż", "x y", &"x".repeat(81)] {
        assert!(!valid_identifier(value));
        assert_eq!(
            validate_project_and_schedule(value, "schedule").unwrap_err(),
            "Invalid project or schedule identifier."
        );
        assert!(validate_project_and_schedule("project", value).is_err());
    }
}

#[test]
fn manifest_accepts_supported_types_intervals_statuses_and_crawl_bounds() {
    for task_type in ["page-audit", "site-crawl"] {
        for interval in [6, 12, 24, 168] {
            for status in ["scheduled", "running", "completed", "failed", "paused"] {
                for limit in [None, Some(1), Some(500)] {
                    let mut task = manifest();
                    task.task_type = task_type.into();
                    task.interval_hours = interval;
                    task.status = status.into();
                    task.crawl_limit = limit;
                    task.last_started_at = Some(task.created_at.clone());
                    task.last_run_at = Some(task.next_run_at.clone());
                    assert!(validate_manifest("project-1", &task).is_ok());
                }
            }
        }
    }
}

#[test]
fn manifest_rejects_each_invalid_field_with_its_own_error() {
    type InvalidCase = (Box<dyn Fn(&mut ScheduledTaskManifest)>, &'static str);
    let cases: Vec<InvalidCase> = vec![
        (
            Box::new(|t| t.schedule_id = "../".into()),
            "Invalid project or schedule identifier.",
        ),
        (
            Box::new(|t| t.task_type = "other".into()),
            "Unsupported scheduled task type.",
        ),
        (
            Box::new(|t| t.interval_hours = 0),
            "Unsupported scheduled task interval.",
        ),
        (
            Box::new(|t| t.status = "other".into()),
            "Unsupported scheduled task status.",
        ),
        (
            Box::new(|t| t.url = "file:///etc/passwd".into()),
            "Invalid scheduled URL:",
        ),
        (
            Box::new(|t| t.url = "https://user@example.test".into()),
            "Invalid scheduled URL: URLs containing embedded credentials are not allowed",
        ),
        (
            Box::new(|t| t.next_run_at = "bad".into()),
            "Scheduled task next run must be an RFC3339 timestamp.",
        ),
        (
            Box::new(|t| t.created_at = "bad".into()),
            "Scheduled task creation time must be an RFC3339 timestamp.",
        ),
        (
            Box::new(|t| t.last_started_at = Some("bad".into())),
            "Scheduled task history time must be an RFC3339 timestamp.",
        ),
        (
            Box::new(|t| t.last_run_at = Some("bad".into())),
            "Scheduled task history time must be an RFC3339 timestamp.",
        ),
    ];
    for (mutate, expected) in cases {
        let mut task = manifest();
        mutate(&mut task);
        let error = validate_manifest("project-1", &task).unwrap_err();
        assert!(
            error.starts_with(expected),
            "expected {expected}, got {error}"
        );
    }
    for limit in [0, 501] {
        let mut task = manifest();
        task.task_type = "site-crawl".into();
        task.crawl_limit = Some(limit);
        assert_eq!(
            validate_manifest("project-1", &task).unwrap_err(),
            "Scheduled crawl limit must be between 1 and 500 pages."
        );
    }
}

#[test]
fn manifest_uses_shared_url_normalization_and_ssrf_protection() {
    let mut task = manifest();
    task.url = "example.test/path".into();
    assert!(validate_manifest("project-1", &task).is_ok());

    for url in [
        "http://127.0.0.1/private",
        "http://localhost/private",
        "http://service.internal/private",
    ] {
        task.url = url.into();
        assert!(validate_manifest("project-1", &task)
            .unwrap_err()
            .starts_with("Invalid scheduled URL:"));
    }
}
