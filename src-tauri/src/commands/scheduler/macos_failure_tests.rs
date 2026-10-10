use super::super::shared::task_name;
use super::test_support::FakeRunner;
use super::{register_platform_with, unregister_platform_with};
use std::{
    fs,
    path::{Path, PathBuf},
};

fn temp_path(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("seomi-scheduler-{label}-{}", uuid::Uuid::new_v4()))
}

fn executable() -> &'static Path {
    Path::new("/Applications/SEOmi.app/Contents/MacOS/seomi")
}

#[test]
fn register_reports_a_home_path_that_is_a_file() {
    let home = temp_path("home-file");
    fs::write(&home, b"not a directory").unwrap();
    let error = register_platform_with(
        &home,
        executable(),
        "project",
        "schedule",
        "2026-10-01T08:00:00Z",
        false,
        &FakeRunner::new("501\n", true, Ok(true)),
    )
    .unwrap_err();
    assert!(error.contains("Unable to create macOS LaunchAgents directory"));
    fs::remove_file(home).unwrap();
}

#[test]
fn register_reports_a_plist_path_that_is_a_directory() {
    let home = temp_path("plist-directory");
    fs::create_dir_all(home.join("Library/LaunchAgents")).unwrap();
    let plist = home
        .join("Library/LaunchAgents")
        .join(format!("{}.plist", task_name("project", "schedule")));
    fs::create_dir(&plist).unwrap();
    let error = register_platform_with(
        &home,
        executable(),
        "project",
        "schedule",
        "2026-10-01T08:00:00Z",
        false,
        &FakeRunner::new("501\n", true, Ok(true)),
    )
    .unwrap_err();
    assert!(error.contains("Unable to write macOS schedule"));
    fs::remove_dir_all(home).unwrap();
}

#[test]
fn unregister_reports_a_schedule_path_that_is_a_directory() {
    let home = temp_path("remove-directory");
    let launch_agents = home.join("Library/LaunchAgents");
    fs::create_dir_all(&launch_agents).unwrap();
    let plist = launch_agents.join(format!("{}.plist", task_name("project", "schedule")));
    fs::create_dir(&plist).unwrap();
    let error = unregister_platform_with(
        &home,
        "project",
        "schedule",
        false,
        &FakeRunner::new("501\n", true, Ok(true)),
    )
    .unwrap_err();
    assert!(error.contains("Unable to remove macOS schedule"));
    fs::remove_dir_all(home).unwrap();
}
