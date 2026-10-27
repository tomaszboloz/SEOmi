use super::test_support::FakeRunner;
use super::unregister_platform_with;
use std::path::Path;

#[test]
fn unregister_rejects_unsuccessful_and_empty_user_ids_before_bootout() {
    let failed = FakeRunner::new("501\n", false, Ok(true));
    let error = unregister_platform_with(
        Path::new("/tmp/seomi-scheduler-test-home"),
        "project",
        "schedule",
        false,
        &failed,
    )
    .unwrap_err();
    assert_eq!(error, "Unable to resolve macOS user id.");
    assert!(failed
        .calls
        .borrow()
        .iter()
        .all(|(program, _)| program != "launchctl"));

    let empty = FakeRunner::new("\n", true, Ok(true));
    let error = unregister_platform_with(
        Path::new("/tmp/seomi-scheduler-test-home"),
        "project",
        "schedule",
        false,
        &empty,
    )
    .unwrap_err();
    assert_eq!(error, "Invalid macOS user id.");
    assert!(empty
        .calls
        .borrow()
        .iter()
        .all(|(program, _)| program != "launchctl"));
}
