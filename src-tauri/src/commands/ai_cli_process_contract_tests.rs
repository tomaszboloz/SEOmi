use super::{
    research::{resolve_ai_command, run_ai_cli_resolved, write_gemini_settings},
    tests::{executable_fixture::executable_fixture, fixture_process},
    version::version_check_resolved_with,
};
use std::fs;
use tokio::time::Duration;
use uuid::Uuid;

const COMPLEX_PROMPT: &str =
    "test prompt with Unicode: łąka, emoji 🔍, shell: $VAR \"quotes\" 'single' & | < > `cmd` ; %TEMP%";

#[tokio::test]
async fn resolved_runner_executes_hermetic_claude_and_gemini_fixtures() {
    let (cleanup, command, root) = executable_fixture("claude");
    assert_eq!(
        run_ai_cli_resolved(
            "claude".into(),
            COMPLEX_PROMPT.into(),
            None,
            "claude",
            &command,
            &root
        )
        .await
        .unwrap(),
        "answer"
    );
    assert_eq!(
        fs::read_to_string(root.join("prompt.txt")).unwrap(),
        COMPLEX_PROMPT
    );
    let error = run_ai_cli_resolved(
        "claude".into(),
        COMPLEX_PROMPT.into(),
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
            COMPLEX_PROMPT.into(),
            None,
            "gemini",
            &command,
            &root
        )
        .await
        .unwrap(),
        "answer"
    );
    assert_eq!(
        fs::read_to_string(root.join("prompt.txt")).unwrap(),
        COMPLEX_PROMPT
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
                tokio::process::Command::new(&missing)
            }
        })
        .await;
    assert!(detail.contains("Unable to verify CLI authentication"));
    drop(cleanup);
}
