use super::{models::ScheduledLaunchContext, validation::valid_identifier};

pub(super) fn launch_context_from_args(args: &[String]) -> ScheduledLaunchContext {
    const RESERVED_FLAGS: [&str; 4] = [
        "--seomi-scheduled-project",
        "--seomi-scheduled-id",
        "--seomi-scheduled-headless",
        "--seomi-audit-queue-headless",
    ];
    let value_after = |flag: &str| {
        args.windows(2)
            .find(|pair| pair[0] == flag)
            .map(|pair| pair[1].clone())
            .filter(|value| !RESERVED_FLAGS.contains(&value.as_str()) && valid_identifier(value))
    };
    ScheduledLaunchContext {
        project_id: value_after("--seomi-scheduled-project"),
        schedule_id: value_after("--seomi-scheduled-id"),
        headless: args
            .iter()
            .any(|value| value == "--seomi-scheduled-headless"),
    }
}
