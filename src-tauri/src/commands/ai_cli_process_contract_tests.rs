use super::{
    auth::required_capabilities,
    research::{resolve_ai_command, run_ai_cli_resolved, write_gemini_settings, ResearchDirectory},
    resolution::ResolvedCommand,
    version::version_check_resolved_with,
};
use std::{fs, path::PathBuf};
use tokio::{process::Command, time::Duration};
use uuid::Uuid;

fn executable_fixture(provider: &str) -> (ResearchDirectory, ResolvedCommand, PathBuf) {
    let root = std::env::temp_dir().join(format!("seomi-contract-{}", Uuid::new_v4()));
    fs::create_dir(&root).unwrap();
    let flags = required_capabilities(provider).join(" ");
    #[cfg(windows)]
    {
        let program = root.join("fixture.cmd");
        fs::write(
            &program,
            format!("@echo off\r\nif \"%~1\"==\"--help\" (echo {flags}) else (echo answer)\r\n"),
        )
        .unwrap();
        return (
            ResearchDirectory(root.clone()),
            ResolvedCommand {
                program,
                use_cmd_shell: true,
            },
            root,
        );
    }
    #[cfg(not(windows))]
    {
        use std::os::unix::fs::PermissionsExt;
        let program = root.join("fixture.sh");
        fs::write(&program, format!("#!/bin/sh\nif [ \"$1\" = \"--help\" ]; then printf '%s' '{flags}'; else printf '%s' 'answer'; fi\n")).unwrap();
        fs::set_permissions(&program, fs::Permissions::from_mode(0o700)).unwrap();
        (
            ResearchDirectory(root.clone()),
            ResolvedCommand { program },
            root,
        )
    }
}

fn fixture_process(unix: &str, windows: &str) -> Command {
    #[cfg(not(windows))]
    {
        let _ = windows;
        let mut process = Command::new("sh");
        process.args(["-c", unix]);
        process
    }
    #[cfg(windows)]
    {
        let _ = unix;
        let mut process = Command::new("powershell.exe");
        process.args(["-NoProfile", "-NonInteractive", "-Command", windows]);
        process
    }
}

#[tokio::test]
async fn resolved_runner_executes_hermetic_claude_and_gemini_fixtures() {
    let (cleanup, command, root) = executable_fixture("claude");
    assert_eq!(
        run_ai_cli_resolved(
            "claude".into(),
            "hello".into(),
            None,
            "claude",
            &command,
            &root
        )
        .await
        .unwrap(),
        "answer"
    );
    let error = run_ai_cli_resolved(
        "claude".into(),
        "hello".into(),
        Some("bad model".into()),
        "claude",
        &command,
        &root,
    )
    .await
    .unwrap_err();
    assert!(error.contains("unsupported characters"));
    drop(cleanup);
    let (cleanup, command, root) = executable_fixture("gemini");
    assert_eq!(
        run_ai_cli_resolved(
            "gemini".into(),
            "hello".into(),
            None,
            "gemini",
            &command,
            &root
        )
        .await
        .unwrap(),
        "answer"
    );
    drop(cleanup);
}

#[test]
fn missing_cli_and_gemini_settings_fail_with_explicit_errors() {
    let missing = format!("seomi-missing-{}", Uuid::new_v4());
    assert!(resolve_ai_command(&missing)
        .unwrap_err()
        .contains("not installed"));
    let (cleanup, _command, root) = executable_fixture("gemini");
    fs::create_dir(root.join("research-settings.json")).unwrap();
    assert_eq!(
        write_gemini_settings(&root, "context.md").unwrap_err(),
        "Unable to prepare Gemini research settings."
    );
    drop(cleanup);
}

#[tokio::test]
async fn version_timeout_and_auth_process_failure_are_explicit() {
    let (cleanup, command, _) = executable_fixture("gemini");
    let (_, detail) =
        version_check_resolved_with("gemini", &command, Duration::from_millis(20), |_, _| {
            fixture_process("sleep 1", "Start-Sleep -Seconds 1")
        })
        .await;
    assert_eq!(detail, "Version check timed out.");
    let missing = std::env::temp_dir().join(format!("seomi-missing-{}", Uuid::new_v4()));
    let auth_failure_deadline = Duration::from_secs(if cfg!(windows) { 30 } else { 1 });
    let (_, detail) =
        version_check_resolved_with("openai", &command, auth_failure_deadline, move |_, args| {
            if args.first().is_some_and(|arg| arg == "--version") {
                fixture_process("printf '1.0'", "Write-Output '1.0'")
            } else {
                Command::new(&missing)
            }
        })
        .await;
    assert!(detail.contains("Unable to verify CLI authentication"));
    drop(cleanup);
}
