use super::*;

#[test]
fn invalid_queue_identity_and_timestamp_never_call_registrar() {
    for (project, run, date, expected) in [
        (
            "../bad",
            "run",
            "2026-10-01T12:00:00Z",
            "Invalid project or queue run identifier.",
        ),
        (
            "project",
            "../bad",
            "2026-10-01T12:00:00Z",
            "Invalid project or queue run identifier.",
        ),
        (
            "project",
            "run",
            "bad",
            "Queue wake-up must be an RFC3339 timestamp.",
        ),
    ] {
        let result = register_audit_queue_wakeup_with(
            project.into(),
            run.into(),
            date.into(),
            |_, _, _, _| panic!("invalid request reached platform"),
        );
        assert_eq!(result.unwrap_err(), expected);
    }
}

#[test]
fn registration_preserves_platform_failure_without_claiming_success() {
    let error = register_audit_wakeup_with(
        "project".into(),
        "schedule".into(),
        "2026-10-01T12:00:00Z".into(),
        24,
        |_, _, _, _| Err("platform unavailable".into()),
    )
    .unwrap_err();
    assert_eq!(error, "platform unavailable");
    let error = register_audit_queue_wakeup_with(
        "project".into(),
        "run".into(),
        "2026-10-01T12:00:00Z".into(),
        |_, _, _, _| Err("queue unavailable".into()),
    )
    .unwrap_err();
    assert_eq!(error, "queue unavailable");
}

#[test]
fn unregister_rejects_invalid_identifiers_before_platform_and_preserves_errors() {
    assert_eq!(
        unregister_audit_wakeup_with("project", "../bad", |_, _, _| panic!(
            "invalid schedule reached platform"
        ))
        .unwrap_err(),
        "Invalid project or schedule identifier."
    );
    assert_eq!(
        unregister_audit_queue_wakeup_with("../bad", "run", |_, _, _| panic!(
            "invalid queue reached platform"
        ))
        .unwrap_err(),
        "Invalid project or queue run identifier."
    );
    assert_eq!(
        unregister_audit_wakeup_with("project", "schedule", |_, _, _| Err("cannot remove".into()))
            .unwrap_err(),
        "cannot remove"
    );
    assert_eq!(
        unregister_audit_queue_wakeup_with("project", "run", |_, _, _| Err(
            "cannot remove queue".into()
        ))
        .unwrap_err(),
        "cannot remove queue"
    );
}
