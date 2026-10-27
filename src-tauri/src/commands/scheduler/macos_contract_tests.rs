use super::test_support::FakeRunner;
use super::{register_platform_with, unregister_platform_with};
use std::{
    fs,
    path::{Path, PathBuf},
};

fn home() -> PathBuf {
    let path = std::env::temp_dir().join(format!("seomi-scheduler-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&path).unwrap();
    path
}

fn executable() -> &'static Path {
    Path::new("/Applications/SEOmi.app/Contents/MacOS/seomi")
}

#[test]
fn register_writes_isolated_plist_and_records_launchctl_success() {
    let home = home();
    let runner = FakeRunner::new("501\n", true, Ok(true));
    let label = register_platform_with(
        &home,
        executable(),
        "project",
        "schedule",
        "2026-10-01T08:00:00Z",
        false,
        &runner,
    )
    .unwrap();
    let plist = home
        .join("Library/LaunchAgents")
        .join(format!("{label}.plist"));
    let xml = fs::read_to_string(plist).unwrap();
    assert!(xml.contains("--seomi-scheduled-headless"));
    assert!(runner
        .calls
        .borrow()
        .iter()
        .any(|(_, args)| args.first().map(String::as_str) == Some("bootstrap")));
    fs::remove_dir_all(home).unwrap();
}

#[test]
fn register_reports_runner_and_uid_failures_without_real_scheduler_mutation() {
    let home = home();
    let error = register_platform_with(
        &home,
        executable(),
        "project",
        "schedule",
        "2026-10-01T08:00:00Z",
        true,
        &FakeRunner::new("501\n", true, Err("down")),
    )
    .unwrap_err();
    assert!(error.contains("Unable to register macOS schedule"));
    let error = register_platform_with(
        &home,
        executable(),
        "project",
        "schedule",
        "2026-10-01T08:00:00Z",
        false,
        &FakeRunner::new("501\n", true, Ok(false)),
    )
    .unwrap_err();
    assert!(error.contains("rejected"));
    let error = register_platform_with(
        &home,
        executable(),
        "project",
        "schedule",
        "2026-10-01T08:00:00Z",
        false,
        &FakeRunner::new("501\n", false, Ok(true)),
    )
    .unwrap_err();
    assert!(error.contains("Unable to resolve macOS user id"));
    let error = register_platform_with(
        &home,
        executable(),
        "project",
        "schedule",
        "2026-10-01T08:00:00Z",
        false,
        &FakeRunner::new("bad\n", true, Ok(true)),
    )
    .unwrap_err();
    assert!(error.contains("Invalid macOS user id"));
    fs::remove_dir_all(home).unwrap();
}

#[test]
fn unregister_uses_isolated_home_and_removes_existing_plist() {
    let home = home();
    let launch_agents = home.join("Library/LaunchAgents");
    fs::create_dir_all(&launch_agents).unwrap();
    let path = launch_agents.join("seomi-audit-queue-project-run.plist");
    fs::write(&path, "fixture").unwrap();
    let runner = FakeRunner::new("501\n", true, Ok(true));
    unregister_platform_with(&home, "project", "run", true, &runner).unwrap();
    assert!(!path.exists());
    assert!(runner
        .calls
        .borrow()
        .iter()
        .any(|(_, args)| args.first().map(String::as_str) == Some("bootout")));
    fs::remove_dir_all(home).unwrap();
}

#[test]
fn unregister_rejects_bad_uid_and_tolerates_bootout_error() {
    let home = home();
    let error = unregister_platform_with(
        &home,
        "project",
        "run",
        false,
        &FakeRunner::new("bad", true, Ok(true)),
    )
    .unwrap_err();
    assert!(error.contains("Invalid macOS user id"));
    let runner = FakeRunner::new("501\n", true, Err("bootout"));
    unregister_platform_with(&home, "project", "run", false, &runner).unwrap();
    fs::remove_dir_all(home).unwrap();
}
