pub(super) fn build_ai_cli_arguments(
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
