use super::ResearchDirectory;
use tokio::process::Command;

// Windows PowerShell cold-start loads .NET. Serializing test fixtures avoids
// competing startup work on shared runners. Acquire before starting the
// unchanged deadlines; production process execution stays parallel.
pub(super) static FIXTURE_PROCESS_GATE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

pub(crate) async fn collect_fixture_output(
    process: Command,
    prompt: &str,
    deadline: super::Duration,
) -> Result<std::process::Output, String> {
    #[cfg(target_os = "windows")]
    let _permit = FIXTURE_PROCESS_GATE.lock().await;
    super::collect_research_output(process, prompt, deadline).await
}

pub(crate) fn fixture_process(unix_script: &str, windows_script: &str) -> Command {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = windows_script;
        let mut process = Command::new("sh");
        process.args(["-c", unix_script]);
        process.kill_on_drop(true);
        process
    }
    #[cfg(target_os = "windows")]
    {
        let _ = unix_script;
        let mut process = Command::new("powershell.exe");
        process.args(["-NoProfile", "-NonInteractive", "-Command", windows_script]);
        process.kill_on_drop(true);
        process
    }
}

pub(crate) async fn capability_fixture(
    provider: &str,
    help: &str,
    exit_code: u8,
) -> Result<(), String> {
    let directory =
        super::env::temp_dir().join(format!("seomi-capabilities-{}", super::Uuid::new_v4()));
    super::fs::create_dir_all(&directory).unwrap();
    let _cleanup = ResearchDirectory(directory.clone());
    #[cfg(target_os = "windows")]
    let program = directory.join("fixture.cmd");
    #[cfg(not(target_os = "windows"))]
    let program = directory.join("fixture.sh");
    #[cfg(target_os = "windows")]
    super::fs::write(
        &program,
        format!("@echo off\r\necho {help}\r\nexit /b {exit_code}\r\n"),
    )
    .unwrap();
    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        super::fs::write(
            &program,
            format!("#!/bin/sh\nprintf '%s' '{help}'\nexit {exit_code}\n"),
        )
        .unwrap();
        super::fs::set_permissions(&program, super::fs::Permissions::from_mode(0o700)).unwrap();
    }
    super::check_capabilities(
        provider,
        &super::ResolvedCommand {
            program,
            #[cfg(target_os = "windows")]
            use_cmd_shell: true,
        },
    )
    .await
}
