use super::test_fixture::{executable, home, FakeRunner};
use super::{register_platform_with, unregister_platform_with};
use std::{fs, path::Path};

fn register(home: &Path, runner: &FakeRunner) -> Result<String, String> {
    register_platform_with(home, executable(), "project", "run", "2026-10-01T08:00:00Z", false, runner)
}

#[test]
fn reports_uid_process_errors_and_rejected_status_for_both_operations() {
    let home = home();
    let mut runner = FakeRunner::new("501", true, Ok(true));
    runner.uid_error = Some("id unavailable");
    assert!(register(&home, &runner).unwrap_err().contains("Unable to resolve macOS user id:"));
    assert!(unregister_platform_with(&home, "project", "run", false, &runner)
        .unwrap_err().contains("Unable to resolve macOS user id:"));
    runner.uid_error = None;
    runner.uid_success = false;
    assert_eq!(unregister_platform_with(&home, "project", "run", false, &runner)
        .unwrap_err(), "Unable to resolve macOS user id.");
    assert!(runner.calls.borrow().iter().all(|(program, _)| program == "id"));
    fs::remove_dir_all(home).unwrap();
}

#[test]
fn rejects_empty_uid_before_launchctl() {
    let home = home();
    let runner = FakeRunner::new(" \n", true, Ok(true));
    assert_eq!(register(&home, &runner).unwrap_err(), "Invalid macOS user id.");
    assert_eq!(unregister_platform_with(&home, "project", "run", false, &runner)
        .unwrap_err(), "Invalid macOS user id.");
    assert!(runner.calls.borrow().iter().all(|(program, _)| program == "id"));
    fs::remove_dir_all(home).unwrap();
}

#[test]
fn register_reports_directory_and_plist_write_failures() {
    let home = home();
    let runner = FakeRunner::new("501", true, Ok(true));
    let library = home.join("Library");
    fs::write(&library, "file").unwrap();
    assert!(register(&home, &runner).unwrap_err().contains("Unable to create macOS LaunchAgents directory:"));
    fs::remove_file(&library).unwrap();
    fs::create_dir_all(library.join("LaunchAgents/seomi-audit-project-run.plist")).unwrap();
    assert!(register(&home, &runner).unwrap_err().contains("Unable to write macOS schedule:"));
    assert!(runner.calls.borrow().is_empty());
    fs::remove_dir_all(home).unwrap();
}

#[test]
fn unregister_reports_removal_failure_and_preserves_existing_entry() {
    let home = home();
    let runner = FakeRunner::new("501", true, Ok(true));
    let plist = home.join("Library/LaunchAgents/seomi-audit-project-run.plist");
    fs::create_dir_all(&plist).unwrap();
    assert!(unregister_platform_with(&home, "project", "run", false, &runner)
        .unwrap_err().contains("Unable to remove macOS schedule:"));
    assert!(plist.is_dir());
    fs::remove_dir_all(home).unwrap();
}

#[test]
fn queue_registration_keeps_bootstrap_arguments_after_bootout_error() {
    let home = home();
    let mut runner = FakeRunner::new("501\n", true, Ok(true));
    runner.bootout = Err("not registered");
    let label = register_platform_with(&home, executable(), "project", "run",
        "2026-10-01T08:00:00Z", true, &runner).unwrap();
    assert_eq!(label, "seomi-audit-queue-project-run");
    let plist = home.join("Library/LaunchAgents").join(format!("{label}.plist"));
    assert!(fs::read_to_string(&plist).unwrap().contains("--seomi-audit-queue-headless"));
    assert_eq!(*runner.calls.borrow(), vec![
        ("id".into(), vec!["-u".into()]),
        ("launchctl".into(), vec!["bootout".into(), format!("gui/501/{label}")]),
        ("launchctl".into(), vec!["bootstrap".into(), "gui/501".into(), plist.to_string_lossy().into_owned()]),
    ]);
    unregister_platform_with(&home, "project", "run", true, &runner).unwrap();
    assert!(!plist.exists());
    fs::remove_dir_all(home).unwrap();
}
