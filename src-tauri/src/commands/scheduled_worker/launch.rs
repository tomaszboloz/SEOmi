use super::models::valid_identifier;

pub fn headless_launch_context() -> Option<(String, String)> {
    let args = std::env::args().collect::<Vec<_>>();
    if !args.iter().any(|v| v == "--seomi-scheduled-headless") {
        return None;
    }
    let value_after = |flag: &str| {
        args.windows(2)
            .find(|pair| pair[0] == flag)
            .map(|pair| pair[1].clone())
            .filter(|v| valid_identifier(v))
    };
    let project_id = value_after("--seomi-scheduled-project")?;
    let schedule_id = value_after("--seomi-scheduled-id")?;
    Some((project_id, schedule_id))
}
