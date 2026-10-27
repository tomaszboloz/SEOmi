use super::*;

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
        register_audit_wakeup("project".into(), "schedule".into(), "invalid".into(), 24).is_err()
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
    assert!(register_audit_queue_wakeup("project".into(), "run".into(), "invalid".into()).is_err());
}

#[test]
fn public_launch_context_has_no_schedule_without_scheduler_flags() {
    let context = scheduled_launch_context();
    assert!(context.project_id.is_none());
    assert!(context.schedule_id.is_none());
    assert!(!context.headless);
}

#[test]
fn unregister_commands_forward_to_fake_platform_without_os_mutation() {
    let calls = std::cell::RefCell::new(Vec::new());
    assert!(super::forwarding::unregister_audit_wakeup_with(
        "seomi-test-proj",
        "seomi-test-sched",
        |project, id, queue| {
            calls
                .borrow_mut()
                .push((project.to_owned(), id.to_owned(), queue));
            Ok(())
        }
    )
    .is_ok());
    assert!(super::forwarding::unregister_audit_queue_wakeup_with(
        "seomi-test-proj",
        "seomi-test-run",
        |project, id, queue| {
            calls
                .borrow_mut()
                .push((project.to_owned(), id.to_owned(), queue));
            Ok(())
        }
    )
    .is_ok());
    assert_eq!(
        calls.into_inner(),
        vec![
            ("seomi-test-proj".into(), "seomi-test-sched".into(), false),
            ("seomi-test-proj".into(), "seomi-test-run".into(), true),
        ]
    );
}
