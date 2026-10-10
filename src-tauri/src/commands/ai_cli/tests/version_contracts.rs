use super::{fixture_process, research_fixture::research_fixture, Duration};
use crate::commands::ai_cli::version::version_check_resolved_with;
use std::sync::Mutex;

#[tokio::test]
async fn successful_version_probes_use_the_exact_provider_auth_command() {
    #[cfg(windows)]
    let _permit = super::fixtures::FIXTURE_PROCESS_GATE.lock().await;
    for (provider, expected, auth) in [
        ("openai", vec!["login", "status"], "Logged in using ChatGPT"),
        ("claude", vec!["auth", "status"], r#"{"loggedIn":true}"#),
    ] {
        let (_cleanup, resolved, _) = research_fixture(provider, false);
        let calls = Mutex::new(Vec::new());
        let result = version_check_resolved_with(
            provider,
            &resolved,
            Duration::from_secs(10),
            |_, arguments| {
                calls.lock().unwrap().push(arguments.to_vec());
                if arguments == ["--version"] {
                    fixture_process(
                        "printf 'fixture 1.0'",
                        "[Console]::Out.Write('fixture 1.0')",
                    )
                } else {
                    fixture_process(
                        &format!("printf '%s' '{auth}'"),
                        &format!("[Console]::Error.Write('{auth}')"),
                    )
                }
            },
        )
        .await;
        assert_eq!(result, (true, "fixture 1.0".into()));
        assert_eq!(
            *calls.lock().unwrap(),
            vec![
                vec!["--version".to_string()],
                expected.into_iter().map(String::from).collect()
            ]
        );
    }
}

#[tokio::test]
async fn failed_version_and_gemini_never_attempt_an_authentication_subprocess() {
    #[cfg(windows)]
    let _permit = super::fixtures::FIXTURE_PROCESS_GATE.lock().await;
    for (provider, fail, expected) in [
        ("openai", true, (false, "version failed")),
        ("gemini", false, (true, "fixture 1.0")),
    ] {
        let (_cleanup, resolved, _) = research_fixture(provider, false);
        let result = version_check_resolved_with(
            provider,
            &resolved,
            Duration::from_secs(10),
            |_, arguments| {
                assert_eq!(arguments, ["--version"]);
                if fail {
                    fixture_process(
                        "printf 'version failed' >&2; exit 7",
                        "[Console]::Error.Write('version failed'); exit 7",
                    )
                } else {
                    fixture_process(
                        "printf 'fixture 1.0'",
                        "[Console]::Out.Write('fixture 1.0')",
                    )
                }
            },
        )
        .await;
        assert_eq!(result, (expected.0, expected.1.into()));
    }
}

#[tokio::test]
async fn authentication_timeout_does_not_report_an_installed_cli_as_connected() {
    #[cfg(windows)]
    let _permit = super::fixtures::FIXTURE_PROCESS_GATE.lock().await;
    let (_cleanup, resolved, _) = research_fixture("openai", false);
    let result = version_check_resolved_with(
        "openai",
        &resolved,
        Duration::from_secs(2),
        |_, arguments| {
            if arguments == ["--version"] {
                fixture_process(
                    "printf 'fixture 1.0'",
                    "[Console]::Out.Write('fixture 1.0')",
                )
            } else {
                fixture_process("sleep 10", "Start-Sleep -Seconds 10")
            }
        },
    )
    .await;
    assert_eq!(
        result,
        (
            false,
            "Unable to verify CLI authentication (timeout or process failure).".into()
        )
    );
}
