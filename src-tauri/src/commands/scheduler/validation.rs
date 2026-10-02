const MAX_IDENTIFIER_LENGTH: usize = 80;

pub(super) fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_IDENTIFIER_LENGTH
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

pub(super) fn validate_schedule_args(
    project_id: &str,
    schedule_id: &str,
    next_run_at: &str,
    interval_hours: u32,
) -> Result<(), String> {
    if !valid_identifier(project_id) || !valid_identifier(schedule_id) {
        return Err("Invalid project or schedule identifier.".into());
    }
    if !matches!(interval_hours, 6 | 12 | 24 | 168) {
        return Err("Unsupported audit schedule interval.".into());
    }
    chrono::DateTime::parse_from_rfc3339(next_run_at)
        .map(|_| ())
        .map_err(|_| "Schedule next run must be an RFC3339 timestamp.".into())
}
