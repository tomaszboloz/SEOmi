use super::super::process::{ProcessResult, ProcessRunner, SystemProcessRunner};
use super::test_support::FakeRunner;
use super::{register_platform_with, task_name, unregister_platform_with};
use std::{
    fs, io,
    path::{Path, PathBuf},
};

struct TempHome(PathBuf);

impl TempHome {
    fn new() -> Self {
        let path =
            std::env::temp_dir().join(format!("seomi-scheduler-edge-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        Self(path)
    }
}

impl Drop for TempHome {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn executable() -> &'static Path {
    Path::new("/Applications/SEOmi.app/Contents/MacOS/seomi")
}

struct ErrorRunner;

impl ProcessRunner for ErrorRunner {
    fn output(&self, _: &str, _: &[String]) -> io::Result<ProcessResult> {
        Err(io::Error::other("runner output unavailable"))
    }

    fn status(&self, _: &str, _: &[String]) -> io::Result<bool> {
        Err(io::Error::other("runner status unavailable"))
    }
}

#[test]
fn register_rejects_an_empty_uid_before_launchctl_mutation() {
    let home = TempHome::new();
    let runner = FakeRunner::new("\n", true, Ok(true));
    let error = register_platform_with(
        &home.0,
        executable(),
        "project",
        "schedule",
        "2026-10-01T08:00:00Z",
        false,
        &runner,
    )
    .unwrap_err();

    assert_eq!(error, "Invalid macOS user id.");
    assert!(!runner
        .calls
        .borrow()
        .iter()
        .any(|(_, args)| { args.first().map(String::as_str) == Some("bootstrap") }));
}

#[test]
fn unregister_tolerates_bootout_error_when_the_plist_is_absent() {
    let home = TempHome::new();
    let runner = FakeRunner::new("501\n", true, Err("bootout unavailable"));

    unregister_platform_with(&home.0, "project", "schedule", false, &runner).unwrap();

    let plist = home
        .0
        .join("Library/LaunchAgents")
        .join(format!("{}.plist", task_name("project", "schedule")));
    assert!(!plist.exists());
    assert!(runner
        .calls
        .borrow()
        .iter()
        .any(|(_, args)| { args.first().map(String::as_str) == Some("bootout") }));
}

#[test]
fn register_and_unregister_surface_runner_output_errors() {
    let home = TempHome::new();
    let error = register_platform_with(
        &home.0,
        executable(),
        "project",
        "schedule",
        "2026-10-01T08:00:00Z",
        false,
        &ErrorRunner,
    )
    .unwrap_err();
    assert_eq!(
        error,
        "Unable to resolve macOS user id: runner output unavailable"
    );

    let error =
        unregister_platform_with(&home.0, "project", "schedule", false, &ErrorRunner).unwrap_err();
    assert_eq!(
        error,
        "Unable to resolve macOS user id: runner output unavailable"
    );
}

#[test]
fn system_runner_propagates_spawn_errors_and_reports_command_status() {
    let runner = SystemProcessRunner;
    let missing = "/definitely/missing/seomi-scheduler-runner";

    assert!(matches!(
        runner.output(missing, &[]),
        Err(error) if error.kind() == io::ErrorKind::NotFound
    ));
    assert!(matches!(
        runner.status(missing, &[]),
        Err(error) if error.kind() == io::ErrorKind::NotFound
    ));
    assert!(runner.status("/usr/bin/true", &[]).unwrap());
    assert!(!runner.status("/usr/bin/false", &[]).unwrap());
}
