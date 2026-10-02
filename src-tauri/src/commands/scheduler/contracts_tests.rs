use super::*;

#[test]
fn identifiers_accept_exact_ascii_boundary_and_reject_unsafe_values() {
    assert!(valid_identifier(&"a".repeat(80)));
    assert!(!valid_identifier(&"a".repeat(81)));
    for invalid in ["", "ą", "a/b", "a\\b", "a b", "a\n", "a\"b", "a;b", "a:b"] {
        assert!(!valid_identifier(invalid), "{invalid:?}");
    }
    assert!(valid_identifier("a-Z_09"));
    assert_eq!(queue_task_name("p", "r"), "seomi-audit-queue-p-r");
}

#[test]
fn all_supported_intervals_and_timestamp_offsets_validate() {
    for interval in [6, 12, 24, 168] {
        assert!(validate_schedule_args("p", "s", "2026-10-03T12:01:00+02:00", interval).is_ok());
    }
    for interval in [0, 1, 23, 169, u32::MAX] {
        assert!(validate_schedule_args("p", "s", "2026-10-03T12:01:00Z", interval).is_err());
    }
}

#[test]
fn minute_rounding_preserves_exact_minutes_and_rounds_fractional_seconds_forward() {
    let exact = chrono::DateTime::parse_from_rfc3339("2026-12-31T23:59:00Z")
        .unwrap()
        .with_timezone(&chrono::Local);
    assert_eq!(ceil_to_minute(exact), exact);
    assert_eq!(
        ceil_to_minute(exact + chrono::Duration::nanoseconds(1)),
        exact + chrono::Duration::minutes(1)
    );
}

#[test]
fn explicit_offsets_and_overdue_exact_minute_keep_future_local_calendar_components() {
    let now = chrono::DateTime::parse_from_rfc3339("2026-10-01T10:00:00+02:00")
        .unwrap()
        .with_timezone(&chrono::Local);
    let trigger = scheduler_time_at("2026-10-01T08:00:00Z", now).unwrap();
    let expected = now + chrono::Duration::minutes(1);
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
        )
    );
}

#[test]
fn registration_and_launch_context_keep_camel_case_ipc_contracts() {
    let registration = SchedulerRegistration {
        platform: "macos".into(),
        task_name: "task".into(),
        next_run_at: "deadline".into(),
        interval_hours: 24,
    };
    assert_eq!(
        serde_json::to_value(registration).unwrap(),
        serde_json::json!({
            "platform":"macos", "taskName":"task", "nextRunAt":"deadline", "intervalHours":24
        })
    );
    assert_eq!(
        serde_json::to_value(ScheduledLaunchContext::default()).unwrap(),
        serde_json::json!({
            "projectId":null, "scheduleId":null, "headless":false
        })
    );
    assert!(current_executable().unwrap().is_file());
}
