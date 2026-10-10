use super::forwarding::*;
use super::launch::*;

#[test]
fn register_audit_wakeup_validates_intervals_and_ids_strictly() {
    for interval in [0, 1, 5, 10, 25, 48, 167, 169] {
        let result = register_audit_wakeup_with(
            "proj-1".into(),
            "sched-1".into(),
            "2026-10-01T12:00:00Z".into(),
            interval,
            |_, _, _, _| panic!("invalid interval reached platform"),
        );
        assert_eq!(result.unwrap_err(), "Unsupported audit schedule interval.");
    }
    for bad_id in ["", "proj/1", "proj 1", "proj@1", "../p", &"x".repeat(81)] {
        let res1 = register_audit_wakeup_with(
            bad_id.into(),
            "sched-1".into(),
            "2026-10-01T12:00:00Z".into(),
            24,
            |_, _, _, _| panic!("invalid project reached platform"),
        );
        assert_eq!(res1.unwrap_err(), "Invalid project or schedule identifier.");

        let res2 = register_audit_wakeup_with(
            "proj-1".into(),
            bad_id.into(),
            "2026-10-01T12:00:00Z".into(),
            24,
            |_, _, _, _| panic!("invalid schedule reached platform"),
        );
        assert_eq!(res2.unwrap_err(), "Invalid project or schedule identifier.");
    }
}

#[test]
fn register_queue_wakeup_validates_ids_and_rfc3339_strictly() {
    for bad_ts in [
        "",
        "not-a-date",
        "2026-10-01",
        "1728000000",
        "2026/10/01 12:00:00",
    ] {
        let result = register_audit_queue_wakeup_with(
            "proj-1".into(),
            "run-1".into(),
            bad_ts.into(),
            |_, _, _, _| panic!("invalid timestamp reached platform"),
        );
        assert_eq!(
            result.unwrap_err(),
            "Queue wake-up must be an RFC3339 timestamp."
        );
    }
    for bad_id in ["", "run/1", "run 1", "run#1", "../r", &"y".repeat(81)] {
        let res = register_audit_queue_wakeup_with(
            "proj-1".into(),
            bad_id.into(),
            "2026-10-01T12:00:00Z".into(),
            |_, _, _, _| panic!("invalid run reached platform"),
        );
        assert_eq!(res.unwrap_err(), "Invalid project or queue run identifier.");
    }
}

#[test]
fn unregister_forwards_errors_and_rejects_malformed_ids() {
    for bad_id in ["", "a/b", "a b", "a:b", &"z".repeat(81)] {
        let err1 = unregister_audit_wakeup_with(bad_id, "sched", |_, _, _| Ok(())).unwrap_err();
        assert_eq!(err1, "Invalid project or schedule identifier.");

        let err2 = unregister_audit_wakeup_with("proj", bad_id, |_, _, _| Ok(())).unwrap_err();
        assert_eq!(err2, "Invalid project or schedule identifier.");

        let err3 = unregister_audit_queue_wakeup_with(bad_id, "run", |_, _, _| Ok(())).unwrap_err();
        assert_eq!(err3, "Invalid project or queue run identifier.");

        let err4 =
            unregister_audit_queue_wakeup_with("proj", bad_id, |_, _, _| Ok(())).unwrap_err();
        assert_eq!(err4, "Invalid project or queue run identifier.");
    }
}

#[test]
fn launch_context_handles_flag_boundary_and_malformed_arguments() {
    let empty_args: Vec<String> = vec![];
    let ctx = launch_context_from_args(&empty_args);
    assert_eq!(ctx.project_id, None);
    assert_eq!(ctx.schedule_id, None);
    assert!(!ctx.headless);

    let trailing_flag = vec!["--seomi-scheduled-project".to_string()];
    let ctx2 = launch_context_from_args(&trailing_flag);
    assert_eq!(ctx2.project_id, None);

    let reserved_values = vec![
        "--seomi-scheduled-project".into(),
        "--seomi-scheduled-id".into(),
        "--seomi-scheduled-id".into(),
        "--seomi-scheduled-headless".into(),
    ];
    let ctx3 = launch_context_from_args(&reserved_values);
    assert_eq!(ctx3.project_id, None);
    assert_eq!(ctx3.schedule_id, None);

    let oversized_id = "a".repeat(81);
    let oversized_args = vec![
        "--seomi-scheduled-project".into(),
        oversized_id,
        "--seomi-scheduled-id".into(),
        "valid-sched".into(),
    ];
    let ctx4 = launch_context_from_args(&oversized_args);
    assert_eq!(ctx4.project_id, None);
    assert_eq!(ctx4.schedule_id, Some("valid-sched".into()));

    assert!(worker_launch_context(&empty_args, "--seomi-scheduled-headless").is_none());
    let missing_sched = vec![
        "--seomi-scheduled-headless".into(),
        "--seomi-scheduled-project".into(),
        "p1".into(),
    ];
    assert!(worker_launch_context(&missing_sched, "--seomi-scheduled-headless").is_none());
}
