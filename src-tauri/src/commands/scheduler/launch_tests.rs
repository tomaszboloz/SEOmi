use super::launch::launch_context_from_args;

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
