use serde::Serialize;
use std::collections::HashSet;
use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use uuid::Uuid;

#[cfg(target_os = "windows")]
use std::ffi::OsStr;

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
    let line = stdout
        .lines()
        .chain(stderr.lines())
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
        "claude" => Some(&["auth", "status", "--text"]),
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
            arguments.extend([
                "exec".to_string(),
                "--skip-git-repo-check".to_string(),
                "--sandbox".to_string(),
                "read-only".to_string(),
            ]);
            if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
                arguments.extend(["--model".to_string(), model]);
            }
            arguments.push(prompt);
        }
        "claude" => {
            arguments.extend([
                "-p".to_string(),
                "--permission-mode".to_string(),
                "plan".to_string(),
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
            ]);
            if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
                arguments.extend(["--model".to_string(), model]);
            }
        }
        _ => return Err("Unsupported AI provider.".to_string()),
    }
    Ok(arguments)
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
        if let Some(path) = augmented_path() {
            process.env("PATH", path);
        }
        process.output()
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
                if let Some(path) = augmented_path() {
                    auth_process.env("PATH", path);
                }
                let auth_result = timeout(Duration::from_secs(5), auth_process.output()).await;
                if let Ok(Ok(auth_output)) = auth_result {
                    let auth_text = output_text(&auth_output);
                    let lower = auth_text.to_ascii_lowercase();
                    let explicitly_logged_out = lower.contains("not logged")
                        || lower.contains("not authenticated")
                        || lower.contains("\"loggedin\":false")
                        || lower.contains("\"logged_in\":false")
                        || lower.contains("logged out");
                    let looks_like_unknown_command = lower.contains("unknown command")
                        || lower.contains("unrecognized")
                        || lower.contains("unexpected argument")
                        || lower.contains("usage:");
                    if !looks_like_unknown_command {
                        available = auth_output.status.success() && !explicitly_logged_out;
                        if !available {
                            auth_detail = display_output(&auth_output);
                        }
                    }
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
    let arguments = build_ai_cli_arguments(&provider, prompt, model)?;

    let isolated_dir = env::temp_dir().join(format!("seomi-ai-{}", Uuid::new_v4().simple()));
    fs::create_dir_all(&isolated_dir)
        .map_err(|error| format!("Unable to prepare an isolated AI working directory: {error}"))?;
    let mut process = process_for(&resolved, &arguments);
    process.current_dir(&isolated_dir);
    // Keep provider authentication in the OS or CLI subscription while
    // preventing project files, global instructions and memory from being
    // discovered by the research command.
    process.env("CODEX_HOME", &isolated_dir);
    process.env("CLAUDE_CONFIG_DIR", isolated_dir.join("claude-config"));
    process.env("GEMINI_CLI_HOME", &isolated_dir);
    if let Some(path) = augmented_path() {
        process.env("PATH", path);
    }

    let output = timeout(CLI_TIMEOUT, process.output())
        .await
        .map_err(|_| "Local CLI timed out after 120 seconds.".to_string())?
        .map_err(|_| format!("{} is not installed or not available on PATH.", command))?;
    let _ = fs::remove_dir_all(&isolated_dir);
    if !output.status.success() {
        let stderr = display_output(&output);
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
    use super::build_ai_cli_arguments;

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
            &["--model".to_string(), "gemini-2.0-flash".to_string()]
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
                "prompt".to_string(),
            ]
        );
    }
}
