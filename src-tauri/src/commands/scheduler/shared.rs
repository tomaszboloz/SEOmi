use std::{env, path::PathBuf};

pub(super) fn task_name(project_id: &str, schedule_id: &str) -> String {
    format!("seomi-audit-{project_id}-{schedule_id}")
}

pub(super) fn queue_task_name(project_id: &str, run_id: &str) -> String {
    format!("seomi-audit-queue-{project_id}-{run_id}")
}

pub(super) fn current_executable() -> Result<PathBuf, String> {
    checked_executable(env::current_exe())
}

pub(super) fn checked_executable(resolved: std::io::Result<PathBuf>) -> Result<PathBuf, String> {
    let executable =
        resolved.map_err(|error| format!("Unable to resolve SEOmi executable: {error}"))?;
    if executable.to_string_lossy().contains('"') {
        return Err("The SEOmi executable path contains an unsupported quote.".into());
    }
    Ok(executable)
}

#[cfg(test)]
mod tests {
    use super::checked_executable;
    use std::{io, path::PathBuf};

    #[test]
    fn executable_resolution_failures_and_quotes_are_rejected() {
        let missing = checked_executable(Err(io::Error::other("gone")));
        assert_eq!(
            missing.unwrap_err(),
            "Unable to resolve SEOmi executable: gone"
        );
        let quoted = checked_executable(Ok(PathBuf::from("/tmp/\"seomi\"")));
        assert!(quoted.unwrap_err().contains("unsupported quote"));
        assert!(checked_executable(Ok(PathBuf::from("/tmp/seomi"))).is_ok());
    }
}
