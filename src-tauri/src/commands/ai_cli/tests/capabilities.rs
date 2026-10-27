use super::{fixtures::capability_fixture, required_capabilities};

#[tokio::test]
async fn supported_cli_help_allows_isolated_research() {
    for provider in ["claude", "openai", "gemini"] {
        let help = required_capabilities(provider).join(" ");
        assert!(capability_fixture(provider, &help, 0).await.is_ok());
    }
}

#[tokio::test]
async fn every_missing_isolation_flag_rejects_the_cli_without_a_fallback() {
    for provider in ["claude", "openai", "gemini"] {
        let flags = required_capabilities(provider);
        for missing in 0..flags.len() {
            let help = flags
                .iter()
                .enumerate()
                .filter_map(|(index, flag)| (index != missing).then_some(*flag))
                .collect::<Vec<_>>()
                .join(" ");
            let error = capability_fixture(provider, &help, 0).await.unwrap_err();
            assert!(error.contains("Update"), "{provider}: {}", flags[missing]);
        }
    }
}

#[tokio::test]
async fn failed_help_command_cannot_pass_even_with_supported_flags_in_output() {
    let help = required_capabilities("claude").join(" ");
    assert!(capability_fixture("claude", &help, 1).await.is_err());
}

#[tokio::test]
async fn missing_help_executable_reports_a_fixed_error_without_exposing_its_path() {
    let resolved = super::ResolvedCommand {
        program: super::env::temp_dir()
            .join(format!("missing-private-cli-{}", super::Uuid::new_v4())),
        #[cfg(target_os = "windows")]
        use_cmd_shell: false,
    };
    let error = super::check_capabilities("claude", &resolved)
        .await
        .unwrap_err();
    assert_eq!(error, "Unable to check local CLI capabilities.");
}

#[cfg(unix)]
#[tokio::test(start_paused = true)]
async fn stalled_help_executable_respects_the_capability_deadline() {
    use std::os::unix::fs::PermissionsExt;
    let directory =
        super::env::temp_dir().join(format!("seomi-stalled-cli-{}", super::Uuid::new_v4()));
    super::fs::create_dir_all(&directory).unwrap();
    let _cleanup = super::ResearchDirectory(directory.clone());
    let program = directory.join("fixture.sh");
    // exec keeps the sleeper in the child PID so kill_on_drop owns its cleanup.
    super::fs::write(&program, "#!/bin/sh\nexec sleep 60\n").unwrap();
    super::fs::set_permissions(&program, super::fs::Permissions::from_mode(0o700)).unwrap();
    let error = super::check_capabilities("claude", &super::ResolvedCommand { program })
        .await
        .unwrap_err();
    assert_eq!(error, "CLI capability check timed out.");
}
