use super::launch::launch_context_from_args;

#[test]
fn recurring_worker_does_not_consume_reserved_flags_as_ids() {
    for flag in [
        "--seomi-scheduled-headless",
        "--seomi-audit-queue-headless",
        "--seomi-scheduled-project",
        "--seomi-scheduled-id",
    ] {
        for missing in ["--seomi-scheduled-project", "--seomi-scheduled-id"] {
            let args = [
                "seomi",
                "--seomi-scheduled-headless",
                "--seomi-scheduled-project",
                "project",
                "--seomi-scheduled-id",
                "schedule",
            ];
            let mut args: Vec<String> = args.iter().map(|v| (*v).into()).collect();
            let index = args.iter().position(|v| v == missing).unwrap();
            args[index + 1] = flag.into();
            assert!(launch_context_from_args(&args).is_none(), "consumed {flag}");
        }
    }
}
