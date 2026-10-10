use super::*;
use std::cell::RefCell;

#[test]
fn recurring_registration_forwards_validated_arguments_to_platform() {
    let calls = RefCell::new(Vec::new());
    let registration = register_audit_wakeup_with(
        "project-1".into(),
        "schedule-1".into(),
        "2026-10-01T12:00:00Z".into(),
        24,
        |project, schedule, next_run, queue| {
            calls.borrow_mut().push((
                project.to_owned(),
                schedule.to_owned(),
                next_run.to_owned(),
                queue,
            ));
            Ok("seomi-audit-project-1-schedule-1".into())
        },
    )
    .unwrap();

    assert_eq!(registration.task_name, "seomi-audit-project-1-schedule-1");
    assert_eq!(registration.next_run_at, "2026-10-01T12:00:00Z");
    assert_eq!(registration.interval_hours, 24);
    assert_eq!(
        calls.into_inner(),
        vec![(
            "project-1".into(),
            "schedule-1".into(),
            "2026-10-01T12:00:00Z".into(),
            false,
        )]
    );
}

#[test]
fn queue_registration_forwards_one_shot_flag_and_zero_interval() {
    let calls = RefCell::new(Vec::new());
    let registration = register_audit_queue_wakeup_with(
        "project-1".into(),
        "run-1".into(),
        "2026-10-01T12:00:00Z".into(),
        |project, run, next_run, queue| {
            calls.borrow_mut().push((
                project.to_owned(),
                run.to_owned(),
                next_run.to_owned(),
                queue,
            ));
            Ok("seomi-audit-queue-project-1-run-1".into())
        },
    )
    .unwrap();

    assert_eq!(registration.task_name, "seomi-audit-queue-project-1-run-1");
    assert_eq!(registration.interval_hours, 0);
    assert!(calls.into_inner()[0].3);
}

#[test]
fn invalid_registration_does_not_call_platform_callback() {
    let called = RefCell::new(false);
    assert!(register_audit_wakeup_with(
        "../project".into(),
        "schedule".into(),
        "2026-10-01T12:00:00Z".into(),
        24,
        |_, _, _, _| {
            *called.borrow_mut() = true;
            Ok("unexpected".into())
        },
    )
    .is_err());
    assert!(!*called.borrow());
}

#[test]
fn unregister_callbacks_receive_recurring_and_queue_modes() {
    let calls = RefCell::new(Vec::new());
    unregister_audit_wakeup_with("project", "schedule", |project, id, queue| {
        calls
            .borrow_mut()
            .push((project.to_owned(), id.to_owned(), queue));
        Ok(())
    })
    .unwrap();
    unregister_audit_queue_wakeup_with("project", "run", |project, id, queue| {
        calls
            .borrow_mut()
            .push((project.to_owned(), id.to_owned(), queue));
        Ok(())
    })
    .unwrap();
    assert_eq!(
        calls.into_inner(),
        vec![
            ("project".into(), "schedule".into(), false),
            ("project".into(), "run".into(), true),
        ]
    );
}
