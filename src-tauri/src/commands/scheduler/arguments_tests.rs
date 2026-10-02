use super::*;

#[test]
fn schedule_arguments_are_strictly_scoped() {
    assert!(validate_schedule_args("project-1", "schedule-1", "2026-09-24T10:00:00Z", 6).is_ok());
    assert!(validate_schedule_args("project/1", "schedule-1", "2026-09-24T10:00:00Z", 6).is_err());
    assert!(validate_schedule_args("project-1", "schedule-1", "2026-09-24T10:00:00Z", 1).is_err());
    assert!(validate_schedule_args("project-1", "schedule-1", "not-a-date", 6).is_err());
}

#[test]
fn task_name_contains_no_user_url_or_secret() {
    assert_eq!(
        task_name("project-1", "schedule-2"),
        "seomi-audit-project-1-schedule-2"
    );
}

#[test]
fn legacy_identifiers_with_underscores_share_the_manifest_contract() {
    assert!(validate_schedule_args(
        "project_legacy_1",
        "schedule_legacy_1",
        "2026-09-24T10:00:00Z",
        24,
    )
    .is_ok());
}

#[cfg(target_os = "macos")]
#[test]
fn plist_arguments_escape_all_xml_metacharacters() {
    assert_eq!(
        escape_xml("a&b<c>d\"e'f"),
        "a&amp;b&lt;c&gt;d&quot;e&apos;f"
    );
    assert_eq!(escape_xml("simple/path"), "simple/path");
}
