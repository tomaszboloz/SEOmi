use std::path::Path;

pub(super) fn schedule_id(path: &Path) -> Option<&str> {
    path.file_name()?
        .to_str()?
        .strip_prefix("scheduled_execution_")?
        .strip_suffix(".json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_execution_json_filenames_provide_an_identity() {
        assert_eq!(
            schedule_id(Path::new("/tmp/scheduled_execution_daily.json")),
            Some("daily")
        );
        for name in [
            "/",
            "scheduled_task_daily.json",
            "scheduled_execution_daily.json.bak",
            "unrelated.json",
        ] {
            assert_eq!(schedule_id(Path::new(name)), None);
        }
    }

    #[cfg(unix)]
    #[test]
    fn non_utf8_filenames_are_rejected_without_filesystem_side_effects() {
        use std::{ffi::OsString, os::unix::ffi::OsStringExt};
        let name = OsString::from_vec(b"scheduled_execution_\xff.json".to_vec());
        assert_eq!(schedule_id(Path::new(&name)), None);
    }
}
