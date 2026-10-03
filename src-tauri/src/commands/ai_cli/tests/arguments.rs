use super::build_ai_cli_arguments;

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
