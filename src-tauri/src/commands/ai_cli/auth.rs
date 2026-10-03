pub(super) fn command_for(provider: &str) -> Result<&'static str, String> {
    match provider {
        "openai" => Ok("codex"),
        "claude" => Ok("claude"),
        "gemini" => Ok("gemini"),
        _ => Err("Unsupported AI provider.".to_string()),
    }
}

pub(super) fn auth_check_args(provider: &str) -> Option<&'static [&'static str]> {
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

pub(super) fn authenticated_output(provider: &str, output: &str) -> bool {
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
    lower.lines().any(|line| {
        let line = line.trim().trim_end_matches(['.', '!']);
        ["logged in", "authenticated"].iter().any(|prefix| {
            line == *prefix
                || line.strip_prefix(prefix).is_some_and(|suffix| {
                    [" using ", " with ", " as ", " via "]
                        .iter()
                        .any(|separator| suffix.starts_with(separator))
                })
        })
    })
}

pub(super) fn required_capabilities(provider: &str) -> &'static [&'static str] {
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
