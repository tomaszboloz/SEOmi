use super::{
    authenticated_output, gemini_research_settings, isolate_process, required_capabilities,
    ResearchDirectory,
};
use std::{ffi::OsStr, path::Path};
use tokio::process::Command;

#[test]
fn isolation_keeps_provider_login_directories() {
    let mut process = Command::new("claude");
    isolate_process(&mut process, Path::new("/tmp/seomi-ai-test"));
    let std_process = process.as_std();

    assert_eq!(
        std_process.get_current_dir(),
        Some(Path::new("/tmp/seomi-ai-test"))
    );
    for key in ["CLAUDE_CONFIG_DIR", "CODEX_HOME", "GEMINI_CLI_HOME"] {
        assert!(
            !std_process
                .get_envs()
                .any(|(name, _)| name == OsStr::new(key)),
            "{key} must not be overridden: it holds the stored CLI login"
        );
    }
}

#[test]
fn authentication_requires_positive_evidence_not_just_a_version_exit_status() {
    assert!(authenticated_output("claude", r#"{ "loggedIn": true }"#));
    assert!(!authenticated_output("claude", r#"{ "loggedIn": false }"#));
    assert!(authenticated_output("openai", "Logged in using ChatGPT"));
    assert!(!authenticated_output("openai", "Not logged in"));
    assert!(!authenticated_output("openai", "Usage: codex login"));
    assert!(!authenticated_output("claude", "unknown command auth"));
    assert!(!authenticated_output("claude", "2.1.285 (Claude Code)"));
}

#[test]
fn gemini_settings_disable_global_context_and_execution_without_moving_login() {
    let settings = gemini_research_settings("unique-empty-context.md");
    assert_eq!(settings["context"]["fileName"], "unique-empty-context.md");
    assert_eq!(settings["skills"]["enabled"], false);
    assert_eq!(settings["hooksConfig"]["enabled"], false);
    assert_eq!(settings["mcp"]["allowed"], serde_json::json!([]));
    assert_eq!(settings["tools"]["core"], serde_json::json!([]));
    assert!(required_capabilities("claude").contains(&"--safe-mode"));
}

#[test]
fn scratch_directory_and_research_settings_are_removed_on_error_paths() {
    let directory = super::env::temp_dir().join(format!("seomi-cleanup-{}", super::Uuid::new_v4()));
    let operation = || -> Result<(), &'static str> {
        super::fs::create_dir_all(&directory).unwrap();
        let _cleanup = ResearchDirectory(directory.clone());
        super::fs::write(directory.join("research-settings.json"), "{}").unwrap();
        Err("simulated request failure")
    };
    assert!(operation().is_err());
    assert!(!directory.exists());
}
