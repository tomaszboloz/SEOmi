use super::{auth::command_for, run_ai_cli, version::version_check};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCliStatus {
    pub provider: String,
    pub command: String,
    pub available: bool,
    pub detail: String,
}

pub(super) async fn detect_ai_clis() -> Vec<AiCliStatus> {
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

pub(super) async fn test_ai_cli_connection(provider: String) -> Result<AiCliStatus, String> {
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
