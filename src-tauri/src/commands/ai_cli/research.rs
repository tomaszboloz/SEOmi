use super::{
    arguments::build_ai_cli_arguments, auth::command_for, capabilities::check_capabilities,
    diagnostics::cli_response, execution::process_for, paths::augmented_path,
    resolution::resolve_command, streams::bounded_process_output,
};
use std::{
    env, fs,
    path::{Path, PathBuf},
};
use tokio::{
    process::Command,
    time::{timeout, Duration},
};
use uuid::Uuid;

pub(super) struct ResearchDirectory(pub(super) PathBuf);
impl Drop for ResearchDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

const CLI_TIMEOUT: Duration = Duration::from_secs(120);

/// Runs the CLI from an empty working directory so project files are not
/// discovered. Provider home and config directories (CLAUDE_CONFIG_DIR,
/// CODEX_HOME, GEMINI_CLI_HOME) are deliberately left alone: they hold the
/// stored login, so pointing them at an empty directory logs the CLI out.
/// Global instructions and memory are disabled through CLI flags instead.
pub(super) fn isolate_process(process: &mut Command, working_dir: &Path) {
    process.current_dir(working_dir).kill_on_drop(true);
}

pub(super) fn gemini_research_settings(context_file: &str) -> serde_json::Value {
    serde_json::json!({
        "context": {"fileName": context_file, "includeDirectoryTree": false, "loadMemoryFromIncludeDirectories": false, "memoryBoundaryMarkers": []},
        "skills": {"enabled": false}, "hooksConfig": {"enabled": false},
        "mcp": {"allowed": []}, "tools": {"core": []}
    })
}

pub(super) async fn run_ai_cli(
    provider: String,
    prompt: String,
    model: Option<String>,
) -> Result<String, String> {
    if prompt.trim().is_empty() {
        return Err("Prompt cannot be empty.".to_string());
    }
    if prompt.len() > 32_000 {
        return Err("Prompt is too large for a local CLI invocation (maximum 32 KB).".to_string());
    }
    if prompt.contains('\0') {
        return Err("Prompt contains an unsupported null character.".to_string());
    }

    let command = command_for(&provider)?;
    let resolved = resolve_command(command).ok_or_else(|| {
        format!("{command} is not installed on PATH or in a known user install location.")
    })?;
    if model.as_ref().is_some_and(|model| {
        !model
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-_.:/".contains(c))
    }) {
        return Err("Model identifier contains unsupported characters.".to_string());
    }
    check_capabilities(&provider, &resolved).await?;
    // The untrusted prompt is sent through stdin, never through cmd.exe's
    // command line (npm CLIs on Windows are commonly .cmd shims).
    let arguments = build_ai_cli_arguments(&provider, "-".to_string(), model)?;

    let isolated_dir = env::temp_dir().join(format!("seomi-ai-{}", Uuid::new_v4().simple()));
    fs::create_dir_all(&isolated_dir)
        .map_err(|error| format!("Unable to prepare an isolated AI working directory: {error}"))?;
    let _cleanup = ResearchDirectory(isolated_dir.clone());
    let mut process = process_for(&resolved, &arguments);
    isolate_process(&mut process, &isolated_dir);
    if provider == "gemini" {
        let settings_path = isolated_dir.join("research-settings.json");
        let settings =
            gemini_research_settings(&format!("seomi-no-context-{}.md", Uuid::new_v4().simple()));
        fs::write(&settings_path, settings.to_string())
            .map_err(|_| "Unable to prepare Gemini research settings.".to_string())?;
        process.env("GEMINI_CLI_SYSTEM_SETTINGS_PATH", settings_path);
        process.env_remove("GEMINI_SYSTEM_MD");
    }
    if let Some(path) = augmented_path() {
        process.env("PATH", path);
    }

    let output = collect_research_output(process, &prompt, CLI_TIMEOUT).await?;
    cli_response(command, &output)
}

pub(super) async fn collect_research_output(
    mut process: Command,
    prompt: &str,
    deadline: Duration,
) -> Result<std::process::Output, String> {
    process.kill_on_drop(true);
    timeout(deadline, bounded_process_output(process, prompt))
        .await
        .map_err(|_| format!("Local CLI timed out after {} seconds.", deadline.as_secs()))?
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::InvalidData {
                "Local CLI exceeded the output limit (2 MiB per stream).".to_string()
            } else {
                "Local CLI could not start or communicate through stdin.".to_string()
            }
        })
}
