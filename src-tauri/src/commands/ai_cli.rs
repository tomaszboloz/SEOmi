mod arguments;
mod auth;
mod capabilities;
mod diagnostics;
mod execution;
mod paths;
mod research;
mod resolution;
mod status;
mod streams;
mod version;

use std::future::Future;

pub use status::AiCliStatus;

#[tauri::command]
pub async fn detect_ai_clis() -> Vec<AiCliStatus> {
    detect_ai_clis_with(version::version_check).await
}

async fn detect_ai_clis_with<F, Fut>(mut check: F) -> Vec<AiCliStatus>
where
    F: FnMut(&'static str, &'static str) -> Fut,
    Fut: Future<Output = (bool, String)>,
{
    let providers = [
        ("openai", "codex"),
        ("claude", "claude"),
        ("gemini", "gemini"),
    ];
    let mut results = Vec::with_capacity(providers.len());
    for (provider, command) in providers {
        let (available, detail) = check(provider, command).await;
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
    status::test_ai_cli_connection(provider).await
}

#[tauri::command]
pub async fn run_ai_cli(
    provider: String,
    prompt: String,
    model: Option<String>,
) -> Result<String, String> {
    research::run_ai_cli(provider, prompt, model).await
}

#[cfg(test)]
use {auth::authenticated_output, diagnostics::display_output, streams::MAX_CLI_OUTPUT_BYTES};
#[cfg(test)]
mod auth_output_tests;
#[cfg(test)]
#[path = "ai_cli_contract_tests.rs"]
mod contract_tests;
#[cfg(test)]
mod diagnostics_tests;
#[cfg(test)]
mod output_limit_tests;
#[cfg(test)]
#[path = "ai_cli_process_contract_tests.rs"]
mod process_contract_tests;
#[cfg(test)]
mod provider_contract_tests;
#[cfg(test)]
mod resolution_tests;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod version_tests;
