use serde::Serialize;
use std::collections::HashSet;
use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use uuid::Uuid;

#[cfg(target_os = "windows")]
use std::ffi::OsStr;

struct ResearchDirectory(PathBuf);
impl Drop for ResearchDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

const MAX_CLI_OUTPUT_BYTES: usize = 2 * 1024 * 1024;

const CLI_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCliStatus {
    pub provider: String,
    pub command: String,
    pub available: bool,
    pub detail: String,
}

fn command_for(provider: &str) -> Result<&'static str, String> {
    match provider {
        "openai" => Ok("codex"),
        "claude" => Ok("claude"),
        "gemini" => Ok("gemini"),
        _ => Err("Unsupported AI provider.".to_string()),
    }
}

#[derive(Debug, Clone)]
struct ResolvedCommand {
    program: PathBuf,
    #[cfg(target_os = "windows")]
    use_cmd_shell: bool,
}

/// A desktop app launched from Finder/Explorer does not necessarily inherit
/// the interactive shell PATH. Resolve the fixed, bundled-provider command in
/// the normal PATH and in the conventional per-user install locations, while
/// never accepting a user-provided executable path from IPC.
fn command_directories() -> Vec<PathBuf> {
    let mut directories: Vec<PathBuf> = env::var_os("PATH")
        .map(|value| env::split_paths(&value).collect())
        .unwrap_or_default();

    if let Some(home) = home_directory() {
        directories.extend([
            home.join(".local/bin"),
            home.join(".npm-global/bin"),
            home.join(".npm/bin"),
            home.join(".volta/bin"),
            home.join(".bun/bin"),
            home.join(".cargo/bin"),
            home.join(".config/bin"),
            home.join("AppData/Roaming/npm"),
            home.join("scoop/shims"),
        ]);

        // nvm keeps one bin directory per installed Node version. Reading the
        // directory names is local-only and bounded; no shell is spawned.
        let nvm_versions = home.join(".nvm/versions/node");
        if let Ok(entries) = fs::read_dir(nvm_versions) {
            for entry in entries.flatten().take(32) {
                directories.push(entry.path().join("bin"));
            }
        }
    }

    #[cfg(target_os = "macos")]
    directories.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
    ]);

    #[cfg(target_os = "windows")]
    directories.extend([
        PathBuf::from(r"C:\Program Files\nodejs"),
        PathBuf::from(r"C:\Program Files\Git\cmd"),
    ]);

    let mut seen = HashSet::new();
    directories
        .into_iter()
        .filter(|directory| seen.insert(directory.clone()))
        .collect()
}

fn command_candidates(command: &str) -> Vec<PathBuf> {
    let directories = command_directories();
    directories
        .into_iter()
        .flat_map(|directory| {
            #[cfg(target_os = "windows")]
            let names = [
                OsString::from(command),
                OsString::from(format!("{command}.cmd")),
                OsString::from(format!("{command}.exe")),
                OsString::from(format!("{command}.bat")),
            ];
            #[cfg(not(target_os = "windows"))]
            let names = [OsString::from(command)];
            names.into_iter().map(move |name| directory.join(name))
        })
        .collect()
}

fn augmented_path() -> Option<OsString> {
    env::join_paths(command_directories()).ok()
}

fn home_directory() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        env::var_os("USERPROFILE").map(PathBuf::from)
    }
    #[cfg(not(target_os = "windows"))]
    {
        env::var_os("HOME").map(PathBuf::from)
    }
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

fn resolve_command(command: &str) -> Option<ResolvedCommand> {
    command_candidates(command)
        .into_iter()
        .find(|candidate| is_executable(candidate))
        .map(|program| ResolvedCommand {
            #[cfg(target_os = "windows")]
            use_cmd_shell: matches!(
                program.extension().and_then(|extension| extension.to_str()),
                Some("cmd" | "bat")
            ),
            program,
        })
}

#[cfg(target_os = "windows")]
fn quote_windows_arg(value: &OsStr) -> String {
    let value = value.to_string_lossy();
    if !value.is_empty()
        && !value
            .chars()
            .any(|character| character.is_whitespace() || character == '"')
    {
        return value.into_owned();
    }

    let mut quoted = String::from("\"");
    let mut backslashes = 0;
    for character in value.chars() {
        if character == '\\' {
            backslashes += 1;
            continue;
        }
        if character == '"' {
            quoted.extend(std::iter::repeat('\\').take(backslashes * 2 + 1));
            quoted.push('"');
        } else {
            quoted.extend(std::iter::repeat('\\').take(backslashes));
            quoted.push(character);
        }
        backslashes = 0;
    }
    quoted.extend(std::iter::repeat('\\').take(backslashes * 2));
    quoted.push('"');
    quoted
}

fn process_for(resolved: &ResolvedCommand, arguments: &[String]) -> Command {
    #[cfg(target_os = "windows")]
    if resolved.use_cmd_shell {
        let mut process = Command::new("cmd.exe");
        let mut command_line = quote_windows_arg(resolved.program.as_os_str());
        for argument in arguments {
            command_line.push(' ');
            command_line.push_str(&quote_windows_arg(OsStr::new(argument)));
        }
        return {
            process.arg("/D").arg("/S").arg("/C").arg(command_line);
            process
        };
    }

    let mut process = Command::new(&resolved.program);
    process.args(arguments);
    process
}

fn display_output(output: &std::process::Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let (primary, secondary) = if output.status.success() {
        (&stdout, &stderr)
    } else {
        (&stderr, &stdout)
    };
    let line = primary
        .lines()
        .chain(secondary.lines())
        .map(str::trim)
        .find(|value| !value.is_empty())
        .unwrap_or("");
    let mut detail = line
        .chars()
        .filter(|character| !character.is_control())
        .collect::<String>();
    if detail.chars().count() > 240 {
        detail = detail.chars().take(237).collect::<String>() + "...";
    }
    detail
}

fn output_text(output: &std::process::Output) -> String {
    let mut text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
    .chars()
    .filter(|character| !character.is_control() || *character == '\n')
    .collect::<String>();
    if text.chars().count() > 2_000 {
        text = text.chars().take(1_997).collect::<String>() + "...";
    }
    text
}

fn auth_check_args(provider: &str) -> Option<&'static [&'static str]> {
    match provider {
        "openai" => Some(&["login", "status"]),
        "claude" => Some(&["auth", "status"]),
        // Gemini CLI versions do not expose one stable non-interactive auth
        // status command. A successful version check remains an availability
        // signal; the first requested workflow reports any login failure.
        "gemini" => None,
        _ => None,
    }
}

fn build_ai_cli_arguments(
    provider: &str,
    prompt: String,
    model: Option<String>,
) -> Result<Vec<String>, String> {
    let mut arguments = Vec::new();
    match provider {
        "openai" => {
            // Skip the user's config.toml, execpolicy rules and memories, and
            // do not persist the research session, without touching CODEX_HOME
            // (which also holds auth.json).
            arguments.extend([
                "exec".to_string(),
                "--skip-git-repo-check".to_string(),
                "--sandbox".to_string(),
                "read-only".to_string(),
                "--ephemeral".to_string(),
                "--ignore-user-config".to_string(),
                "--ignore-rules".to_string(),
                "-c".to_string(),
                "features.memories=false".to_string(),
                "-c".to_string(),
                "project_doc_max_bytes=0".to_string(),
                "-c".to_string(),
                "features.skip_host_skill_discovery=true".to_string(),
                "-c".to_string(),
                "skills.bundled.enabled=false".to_string(),
                "-c".to_string(),
                "skills.include_instructions=false".to_string(),
                "-c".to_string(),
                "features.hooks=false".to_string(),
                "-c".to_string(),
                "features.codex_hooks=false".to_string(),
                "-c".to_string(),
                "features.plugin_hooks=false".to_string(),
                "-c".to_string(),
                "features.shell_tool=false".to_string(),
                "-c".to_string(),
                "web_search=\"disabled\"".to_string(),
            ]);
            if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
                arguments.extend(["--model".to_string(), model]);
            }
            arguments.push(prompt);
        }
        "claude" => {
            // --safe-mode disables CLAUDE.md, memory, skills, hooks and MCP
            // servers while keeping the normal login; changing
            // CLAUDE_CONFIG_DIR instead would lose the stored credentials.
            // User settings (e.g. a preferred reply language) still apply in
            // safe mode, so load only project/local settings, which do not
            // exist in the empty working directory. A non-empty value is used
            // because an empty argument can be dropped by cmd.exe on Windows.
            // Print mode cannot ask for permissions, so read-only web tools
            // are pre-approved; otherwise brand research runs without any
            // web access. --allowedTools is variadic and must be followed by
            // another flag, never directly by the prompt.
            arguments.extend([
                "-p".to_string(),
                "--permission-mode".to_string(),
                "plan".to_string(),
                "--safe-mode".to_string(),
                "--setting-sources".to_string(),
                "project,local".to_string(),
                "--allowedTools".to_string(),
                "WebSearch,WebFetch".to_string(),
                "--tools".to_string(),
                "WebSearch,WebFetch".to_string(),
                "--no-session-persistence".to_string(),
                prompt,
            ]);
            if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
                arguments.extend(["--model".to_string(), model]);
            }
        }
        "gemini" => {
            // Gemini's -p/--prompt option requires its value immediately;
            // placing sandbox flags before the value makes yargs reject the
            // invocation with "Not enough arguments following: p".
            arguments.extend([
                "--prompt".to_string(),
                prompt,
                "--sandbox".to_string(),
                "--approval-mode".to_string(),
                "plan".to_string(),
                "--extensions".to_string(),
                "none".to_string(),
            ]);
            if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
                arguments.extend(["--model".to_string(), model]);
            }
        }
        _ => return Err("Unsupported AI provider.".to_string()),
    }
    Ok(arguments)
}

/// Runs the CLI from an empty working directory so project files are not
/// discovered. Provider home and config directories (CLAUDE_CONFIG_DIR,
/// CODEX_HOME, GEMINI_CLI_HOME) are deliberately left alone: they hold the
/// stored login, so pointing them at an empty directory logs the CLI out.
/// Global instructions and memory are disabled through CLI flags instead.
fn isolate_process(process: &mut Command, working_dir: &Path) {
    process.current_dir(working_dir).kill_on_drop(true);
}

fn authenticated_output(provider: &str, output: &str) -> bool {
    let lower = output.to_ascii_lowercase();
    if lower.contains("not logged")
        || lower.contains("not authenticated")
        || lower.contains("logged out")
    {
        return false;
    }
    if provider == "claude" {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(output) {
            return value.get("loggedIn").and_then(serde_json::Value::as_bool) == Some(true);
        }
    }
    lower.contains("logged in") || lower.contains("authenticated")
}

fn required_capabilities(provider: &str) -> &'static [&'static str] {
    match provider {
        "claude" => &[
            "--safe-mode",
            "--setting-sources",
            "--no-session-persistence",
            "--allowedTools",
            "--tools",
        ],
        "openai" => &["--ephemeral", "--ignore-user-config", "--ignore-rules"],
        "gemini" => &["--extensions", "--approval-mode"],
        _ => &[],
    }
}

async fn check_capabilities(provider: &str, resolved: &ResolvedCommand) -> Result<(), String> {
    let args = if provider == "openai" {
        vec!["exec".into(), "--help".into()]
    } else {
        vec!["--help".into()]
    };
    let mut process = process_for(resolved, &args);
    process.kill_on_drop(true);
    if let Some(path) = augmented_path() {
        process.env("PATH", path);
    }
    let output = timeout(Duration::from_secs(10), bounded_process_output(process, ""))
        .await
        .map_err(|_| "CLI capability check timed out.".to_string())?
        .map_err(|_| "Unable to check local CLI capabilities.".to_string())?;
    let help = output_text_full(&output);
    if !output.status.success()
        || required_capabilities(provider)
            .iter()
            .any(|flag| !help.contains(flag))
    {
        return Err(format!("Update {provider} CLI: this version does not support the isolation flags required for neutral research."));
    }
    Ok(())
}

fn output_text_full(output: &std::process::Output) -> String {
    format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}

fn gemini_research_settings(context_file: &str) -> serde_json::Value {
    serde_json::json!({
        "context": {"fileName": context_file, "includeDirectoryTree": false, "loadMemoryFromIncludeDirectories": false, "memoryBoundaryMarkers": []},
        "skills": {"enabled": false}, "hooksConfig": {"enabled": false},
        "mcp": {"allowed": []}, "tools": {"core": []}
    })
}

async fn version_check(provider: &str, command: &str) -> (bool, String) {
    let Some(resolved) = resolve_command(command) else {
        return (
            false,
            "Not found on PATH or known user install locations.".to_string(),
        );
    };
    let result = timeout(Duration::from_secs(5), {
        let mut process = process_for(&resolved, &["--version".to_string()]);
        process.kill_on_drop(true);
        if let Some(path) = augmented_path() {
            process.env("PATH", path);
        }
        bounded_process_output(process, "")
    })
    .await;
    match result {
        Ok(Ok(output)) if output.status.success() => {
            let detail = display_output(&output);
            let mut available = true;
            let mut auth_detail = String::new();
            if let Some(arguments) = auth_check_args(provider) {
                let auth_arguments = arguments
                    .iter()
                    .map(|argument| (*argument).to_string())
                    .collect::<Vec<_>>();
                let mut auth_process = process_for(&resolved, &auth_arguments);
                auth_process.kill_on_drop(true);
                if let Some(path) = augmented_path() {
                    auth_process.env("PATH", path);
                }
                let auth_result = timeout(
                    Duration::from_secs(5),
                    bounded_process_output(auth_process, ""),
                )
                .await;
                if let Ok(Ok(auth_output)) = auth_result {
                    available = auth_output.status.success()
                        && authenticated_output(provider, &output_text(&auth_output));
                    if !available {
                        auth_detail = "Local CLI is not authenticated. Sign in with the provider CLI and test again.".to_string();
                    }
                } else {
                    available = false;
                    auth_detail =
                        "Unable to verify CLI authentication (timeout or process failure)."
                            .to_string();
                }
            }

            (
                available,
                if !auth_detail.is_empty() {
                    auth_detail
                } else if detail.is_empty() {
                    "Available on PATH.".to_string()
                } else {
                    detail
                },
            )
        }
        Ok(Ok(output)) => {
            let detail = display_output(&output);
            (
                false,
                if detail.is_empty() {
                    "Command is installed but its version check failed.".to_string()
                } else {
                    detail
                },
            )
        }
        Ok(Err(error)) => (false, format!("Unable to start local CLI: {error}")),
        Err(_) => (false, "Version check timed out.".to_string()),
    }
}

#[tauri::command]
pub async fn detect_ai_clis() -> Vec<AiCliStatus> {
    let providers = [
        ("openai", "codex"),
        ("claude", "claude"),
        ("gemini", "gemini"),
    ];
    let mut results = Vec::with_capacity(providers.len());

    for (provider, command) in providers {
        let (available, detail) = version_check(provider, command).await;
        results.push(AiCliStatus {
            provider: provider.to_string(),
            command: command.to_string(),
            available,
            detail,
        });
    }
    results
}

#[tauri::command]
pub async fn test_ai_cli_connection(provider: String) -> Result<AiCliStatus, String> {
    let command = command_for(&provider)?;
    let (available, detail) = if provider == "gemini" {
        // Gemini has no stable auth-status command. An explicit connection
        // test must prove that a minimal isolated request can complete.
        match run_ai_cli(provider.clone(), "Reply with OK only.".into(), None).await {
            Ok(_) => (true, "Authenticated local CLI request completed.".into()),
            Err(error) => (false, error),
        }
    } else {
        version_check(&provider, command).await
    };
    Ok(AiCliStatus {
        provider,
        command: command.into(),
        available,
        detail,
    })
}

#[tauri::command]
pub async fn run_ai_cli(
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

async fn collect_research_output(
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

async fn read_cli_stream<R: AsyncRead + Unpin>(
    mut stream: R,
    limit: usize,
) -> std::io::Result<Vec<u8>> {
    let mut output = Vec::new();
    let mut buffer = [0; 8192];
    loop {
        let count = stream.read(&mut buffer).await?;
        if count == 0 {
            return Ok(output);
        }
        if count > limit.saturating_sub(output.len()) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "CLI output limit exceeded",
            ));
        }
        output.extend_from_slice(&buffer[..count]);
    }
}

async fn bounded_process_output(
    mut process: Command,
    prompt: &str,
) -> std::io::Result<std::process::Output> {
    process
        .kill_on_drop(true)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = process.spawn()?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| std::io::Error::other("Missing CLI stdin"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| std::io::Error::other("Missing CLI stdout"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| std::io::Error::other("Missing CLI stderr"))?;
    // Drain both pipes while writing input: providers may emit output before
    // consuming the prompt. try_join cancels on overflow; child drop kills it.
    let (_, stdout, stderr, status) = tokio::try_join!(
        async {
            stdin.write_all(prompt.as_bytes()).await?;
            drop(stdin);
            Ok::<(), std::io::Error>(())
        },
        read_cli_stream(stdout, MAX_CLI_OUTPUT_BYTES),
        read_cli_stream(stderr, MAX_CLI_OUTPUT_BYTES),
        child.wait(),
    )?;
    Ok(std::process::Output {
        status,
        stdout,
        stderr,
    })
}

fn cli_response(command: &str, output: &std::process::Output) -> Result<String, String> {
    if !output.status.success() {
        let stderr = display_output(output);
        return Err(if stderr.is_empty() {
            format!("{} exited with {}.", command, output.status)
        } else {
            stderr
        });
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Err(format!("{} returned no response.", command));
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::{
        authenticated_output, build_ai_cli_arguments, cli_response, gemini_research_settings,
        isolate_process, required_capabilities, ResearchDirectory,
    };
    use std::ffi::OsStr;
    use std::path::Path;
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
    fn keeps_codex_isolation_flags_before_prompt() {
        let arguments =
            build_ai_cli_arguments("openai", "prompt".to_string(), Some("gpt-5".to_string()))
                .expect("Codex arguments should be supported");

        assert_eq!(
            arguments,
            [
                "exec",
                "--skip-git-repo-check",
                "--sandbox",
                "read-only",
                "--ephemeral",
                "--ignore-user-config",
                "--ignore-rules",
                "-c",
                "features.memories=false",
                "-c",
                "project_doc_max_bytes=0",
                "-c",
                "features.skip_host_skill_discovery=true",
                "-c",
                "skills.bundled.enabled=false",
                "-c",
                "skills.include_instructions=false",
                "-c",
                "features.hooks=false",
                "-c",
                "features.codex_hooks=false",
                "-c",
                "features.plugin_hooks=false",
                "-c",
                "features.shell_tool=false",
                "-c",
                "web_search=\"disabled\"",
                "--model",
                "gpt-5",
                "prompt",
            ]
            .map(String::from)
        );
    }

    #[test]
    fn keeps_gemini_prompt_value_next_to_prompt_flag() {
        let arguments = build_ai_cli_arguments(
            "gemini",
            "Return a JSON object with {title}.".to_string(),
            Some("gemini-2.0-flash".to_string()),
        )
        .expect("Gemini arguments should be supported");

        assert_eq!(arguments[0], "--prompt");
        assert_eq!(arguments[1], "Return a JSON object with {title}.");
        assert_eq!(
            &arguments[2..5],
            &[
                "--sandbox".to_string(),
                "--approval-mode".to_string(),
                "plan".to_string(),
            ]
        );
        assert_eq!(
            &arguments[5..],
            &[
                "--extensions".to_string(),
                "none".to_string(),
                "--model".to_string(),
                "gemini-2.0-flash".to_string()
            ]
        );
    }

    #[test]
    fn keeps_claude_print_flag_and_prompt_contract() {
        let arguments = build_ai_cli_arguments("claude", "prompt".to_string(), None)
            .expect("Claude arguments should be supported");

        assert_eq!(
            arguments,
            [
                "-p".to_string(),
                "--permission-mode".to_string(),
                "plan".to_string(),
                "--safe-mode".to_string(),
                "--setting-sources".to_string(),
                "project,local".to_string(),
                "--allowedTools".to_string(),
                "WebSearch,WebFetch".to_string(),
                "--tools".to_string(),
                "WebSearch,WebFetch".to_string(),
                "--no-session-persistence".to_string(),
                "prompt".to_string(),
            ]
        );
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

    // Windows PowerShell cold-start loads .NET. Serializing test fixtures avoids
    // competing startup work on shared runners. Acquire before starting the
    // unchanged deadlines; production process execution stays parallel.
    #[cfg(target_os = "windows")]
    static FIXTURE_PROCESS_GATE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    pub(super) async fn collect_fixture_output(
        process: Command,
        prompt: &str,
        deadline: super::Duration,
    ) -> Result<std::process::Output, String> {
        #[cfg(target_os = "windows")]
        let _permit = FIXTURE_PROCESS_GATE.lock().await;
        super::collect_research_output(process, prompt, deadline).await
    }

    pub(super) fn fixture_process(unix_script: &str, windows_script: &str) -> Command {
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

    #[tokio::test]
    async fn prompt_is_transmitted_literally_through_stdin_and_closed_at_eof() {
        let prompt =
            "Research & | echo injected; $(whoami) `echo secret` %PATH%\nZażółć gęślą jaźń";
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
        let _permit = FIXTURE_PROCESS_GATE.lock().await;
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

    #[test]
    fn scratch_directory_and_research_settings_are_removed_on_error_paths() {
        let directory =
            super::env::temp_dir().join(format!("seomi-cleanup-{}", super::Uuid::new_v4()));
        let operation = || -> Result<(), &'static str> {
            super::fs::create_dir_all(&directory).unwrap();
            let _cleanup = ResearchDirectory(directory.clone());
            super::fs::write(directory.join("research-settings.json"), "{}").unwrap();
            Err("simulated request failure")
        };
        assert!(operation().is_err());
        assert!(!directory.exists());
    }

    async fn capability_fixture(provider: &str, help: &str, exit_code: u8) -> Result<(), String> {
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
    async fn cli_stream_limit_accepts_boundary_and_rejects_overflow() {
        let accepted = super::read_cli_stream(&b"12345"[..], 5).await.unwrap();
        assert_eq!(accepted, b"12345");
        let error = super::read_cli_stream(&b"123456"[..], 5).await.unwrap_err();
        assert!(error.to_string().contains("output limit"));
    }
}

#[cfg(test)]
#[path = "ai_cli/output_limit_tests.rs"]
mod output_limit_tests;
