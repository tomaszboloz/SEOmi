use super::{cli_response, collect_fixture_output, fixture_process};
use tokio::process::Command;

#[tokio::test]
async fn prompt_is_transmitted_literally_through_stdin_and_closed_at_eof() {
    let prompt = "Research & | echo injected; $(whoami) `echo secret` %PATH%\nZażółć gęślą jaźń";
    let process = fixture_process("cat", "[Console]::OutputEncoding = [Text.UTF8Encoding]::new(); [Console]::InputEncoding = [Text.UTF8Encoding]::new(); [Console]::Out.Write([Console]::In.ReadToEnd())");
    let output = collect_fixture_output(process, prompt, super::Duration::from_secs(10))
        .await
        .unwrap();
    assert!(output.status.success());
    assert_eq!(String::from_utf8(output.stdout).unwrap(), prompt);
}

#[tokio::test]
async fn hung_process_returns_a_timeout_without_waiting_for_its_response() {
    let process = fixture_process("sleep 2", "Start-Sleep -Seconds 2");
    #[cfg(target_os = "windows")]
    let _permit = super::fixtures::FIXTURE_PROCESS_GATE.lock().await;
    let started = std::time::Instant::now();
    let error = super::collect_research_output(process, "", super::Duration::from_millis(50))
        .await
        .unwrap_err();
    assert!(error.contains("timed out"));
    assert!(started.elapsed() < std::time::Duration::from_secs(1));
}

#[tokio::test]
async fn absent_executable_is_a_connection_failure() {
    let process = Command::new(
        super::env::temp_dir().join(format!("seomi-absent-{}", super::Uuid::new_v4())),
    );
    assert!(
        collect_fixture_output(process, "", super::Duration::from_secs(1))
            .await
            .unwrap_err()
            .contains("could not start")
    );
}

#[tokio::test]
async fn nonzero_cli_exit_preserves_the_failure_instead_of_accepting_stdout() {
    let process = fixture_process("printf 'misleading answer'; printf 'login required' >&2; exit 7", "[Console]::Out.Write('misleading answer'); [Console]::Error.Write('login required'); exit 7");
    let output = collect_fixture_output(process, "", super::Duration::from_secs(10))
        .await
        .unwrap();
    assert!(cli_response("fixture", &output)
        .unwrap_err()
        .contains("login required"));
}

#[tokio::test]
async fn successful_but_empty_cli_response_is_not_an_answer() {
    let output = collect_fixture_output(
        fixture_process("exit 0", "exit 0"),
        "",
        super::Duration::from_secs(10),
    )
    .await
    .unwrap();
    assert!(cli_response("fixture", &output)
        .unwrap_err()
        .contains("no response"));
}

#[tokio::test]
async fn cli_stream_limit_accepts_boundary_and_rejects_overflow() {
    let accepted = super::read_cli_stream(&b"12345"[..], 5).await.unwrap();
    assert_eq!(accepted, b"12345");
    let error = super::read_cli_stream(&b"123456"[..], 5).await.unwrap_err();
    assert!(error.to_string().contains("output limit"));
}

#[tokio::test]
async fn process_tests_can_access_the_same_exclusive_fixture_gate() {
    let gate = &super::fixtures::FIXTURE_PROCESS_GATE;
    let permit = gate.lock().await;
    assert!(gate.try_lock().is_err());
    drop(permit);
    // Other Windows fixtures may acquire the gate immediately after release.
    let permit = gate.lock().await;
    assert!(gate.try_lock().is_err());
    drop(permit);
}
