pub(super) fn register_platform(
    _project_id: &str,
    _schedule_id: &str,
    _next_run_at: &str,
    _queue: bool,
) -> Result<String, String> {
    Err("OS audit scheduling is available only in the macOS and Windows desktop builds.".into())
}

pub(super) fn unregister_platform(
    _project_id: &str,
    _schedule_id: &str,
    _queue: bool,
) -> Result<(), String> {
    Err("OS audit scheduling is available only in the macOS and Windows desktop builds.".into())
}
