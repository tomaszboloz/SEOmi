use super::launch::launch_context_from_args;
use super::worker_launch_context;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).into()).collect()
}

#[test]
fn parses_scoped_launch_flags_in_either_order() {
    let context = launch_context_from_args(&args(&[
        "seomi",
        "--seomi-scheduled-headless",
        "--seomi-scheduled-id",
        "schedule_1",
        "--seomi-scheduled-project",
        "project-2",
    ]));
    assert_eq!(context.project_id.as_deref(), Some("project-2"));
    assert_eq!(context.schedule_id.as_deref(), Some("schedule_1"));
    assert!(context.headless);
}

#[test]
fn rejects_missing_values_instead_of_consuming_the_following_flag_as_an_identifier() {
    for flag in [
        "--seomi-scheduled-id",
        "--seomi-scheduled-project",
        "--seomi-scheduled-headless",
        "--seomi-audit-queue-headless",
    ] {
        let context =
            launch_context_from_args(&args(&["seomi", "--seomi-scheduled-project", flag]));
        assert!(
            context.project_id.is_none(),
            "consumed reserved flag {flag}"
        );
        let context = launch_context_from_args(&args(&["seomi", "--seomi-scheduled-id", flag]));
        assert!(
            context.schedule_id.is_none(),
            "consumed reserved flag {flag}"
        );
    }
}

#[test]
fn rejects_empty_unsafe_and_oversized_values_and_keeps_first_duplicate_policy() {
    for invalid in ["", "../p", "a b", "ą", &"a".repeat(81)] {
        let context = launch_context_from_args(&args(&[
            "seomi",
            "--seomi-scheduled-project",
            invalid,
            "--seomi-scheduled-project",
            "later",
            "--seomi-scheduled-id",
            invalid,
        ]));
        assert!(context.project_id.is_none());
        assert!(context.schedule_id.is_none());
    }
    let context = launch_context_from_args(&args(&["seomi", "--seomi-scheduled-id"]));
    assert!(context.schedule_id.is_none());
}

#[test]
fn unrelated_flags_and_queue_launches_do_not_become_recurring_headless_launches() {
    let context = launch_context_from_args(&args(&[
        "seomi",
        "--seomi-audit-queue-headless",
        "--unknown",
    ]));
    assert!(!context.headless);
    assert!(context.project_id.is_none());
    assert!(context.schedule_id.is_none());
}

#[test]
fn worker_context_requires_its_own_mode_and_both_valid_ids() {
    for mode in ["--seomi-scheduled-headless", "--seomi-audit-queue-headless"] {
        let values = args(&[
            "seomi",
            mode,
            "--seomi-scheduled-id",
            "schedule_1",
            "--seomi-scheduled-project",
            "project-2",
        ]);
        assert_eq!(
            worker_launch_context(&values, mode),
            Some(("project-2".into(), "schedule_1".into()))
        );
        assert!(worker_launch_context(&args(&["seomi"]), mode).is_none());
        for invalid in ["", "../", "ż", "a b", &"a".repeat(81)] {
            assert!(worker_launch_context(
                &args(&[
                    "seomi",
                    mode,
                    "--seomi-scheduled-project",
                    invalid,
                    "--seomi-scheduled-id",
                    "run"
                ]),
                mode
            )
            .is_none());
            assert!(worker_launch_context(
                &args(&[
                    "seomi",
                    mode,
                    "--seomi-scheduled-project",
                    "project",
                    "--seomi-scheduled-id",
                    invalid
                ]),
                mode
            )
            .is_none());
        }
        assert!(worker_launch_context(
            &args(&["seomi", mode, "--seomi-scheduled-project", "project"]),
            mode
        )
        .is_none());
        assert!(worker_launch_context(
            &args(&["seomi", mode, "--seomi-scheduled-id", "run"]),
            mode
        )
        .is_none());
        assert_eq!(
            worker_launch_context(
                &args(&[
                    "seomi",
                    mode,
                    "--seomi-scheduled-project",
                    "first",
                    "--seomi-scheduled-project",
                    "second",
                    "--seomi-scheduled-id",
                    "run"
                ]),
                mode
            ),
            Some(("first".into(), "run".into()))
        );
    }
}
