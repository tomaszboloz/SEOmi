use super::{
    research::ResearchDirectory,
    resolution::ResolvedCommand,
    version::{version_check, version_check_resolved},
};
use std::fs;

fn fixture(
    version: &str,
    version_exit: u8,
    auth: &str,
    auth_exit: u8,
) -> (ResearchDirectory, ResolvedCommand) {
    let directory = std::env::temp_dir().join(format!("seomi-version-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&directory).unwrap();
    #[cfg(windows)]
    let program = {
        let path = directory.join("fixture.cmd");
        let echo = |text: &str| {
            if text.is_empty() {
                "echo.".to_string()
            } else {
                format!("echo {text}")
            }
        };
        fs::write(&path, format!("@echo off\r\nif \"%~1\"==\"--version\" (\r\n{}\r\nexit /b {version_exit}\r\n)\r\n{}\r\nexit /b {auth_exit}\r\n",echo(version),echo(auth))).unwrap();
        path
    };
    #[cfg(not(windows))]
    let program = {
        use std::os::unix::fs::PermissionsExt;
        let path = directory.join("fixture.sh");
        fs::write(&path, format!("#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then\nprintf '%s' '{version}'\nexit {version_exit}\nfi\nprintf '%s' '{auth}'\nexit {auth_exit}\n")).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
        path
    };
    (
        ResearchDirectory(directory),
        ResolvedCommand {
            program,
            #[cfg(windows)]
            use_cmd_shell: true,
        },
    )
}

#[tokio::test]
async fn version_authentication_requires_successful_exit_and_positive_status() {
    for (provider, auth, code, available) in [
        ("openai", "Logged in using ChatGPT", 0, true),
        ("openai", "Unauthenticated", 0, false),
        ("openai", "Authenticated: false", 0, false),
        ("openai", "Logged in using ChatGPT", 1, false),
        ("claude", r#"{"loggedIn":true}"#, 0, true),
        ("claude", r#"{"loggedIn":false}"#, 0, false),
    ] {
        let (_cleanup, command) = fixture("fixture 1.0", 0, auth, code);
        let (actual, detail) = version_check_resolved(provider, &command).await;
        assert_eq!(actual, available, "{provider}: {auth}");
        assert_eq!(
            detail,
            if available {
                "fixture 1.0"
            } else {
                "Local CLI is not authenticated. Sign in with the provider CLI and test again."
            }
        );
    }
}

#[tokio::test]
async fn version_without_stable_auth_support_reports_only_availability() {
    for (version, expected) in [("fixture 1.0", "fixture 1.0"), ("", "Available on PATH.")] {
        let (_cleanup, command) = fixture(version, 0, "not logged in", 1);
        assert_eq!(
            version_check_resolved("gemini", &command).await,
            (true, expected.into())
        );
    }
}

#[tokio::test]
async fn failed_version_preserves_diagnostics_or_reports_an_explicit_failure() {
    for (version, expected) in [
        ("fixture failure", "fixture failure"),
        ("", "Command is installed but its version check failed."),
    ] {
        let (_cleanup, command) = fixture(version, 1, "Logged in", 0);
        assert_eq!(
            version_check_resolved("openai", &command).await,
            (false, expected.into())
        );
    }
}

#[tokio::test]
async fn absent_command_and_disappeared_executable_are_distinct_failures() {
    let missing = format!("seomi-absent-{}", uuid::Uuid::new_v4());
    assert_eq!(
        version_check("openai", &missing).await,
        (
            false,
            "Not found on PATH or known user install locations.".into()
        )
    );
    let command = ResolvedCommand {
        program: std::env::temp_dir().join(missing),
        #[cfg(windows)]
        use_cmd_shell: false,
    };
    let (available, detail) = version_check_resolved("openai", &command).await;
    assert!(!available);
    assert!(detail.starts_with("Unable to start local CLI:"));
}
