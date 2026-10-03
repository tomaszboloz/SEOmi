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

pub use status::AiCliStatus;

#[tauri::command]
pub async fn detect_ai_clis() -> Vec<AiCliStatus> {
    status::detect_ai_clis().await
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
mod diagnostics_tests;
#[cfg(test)]
mod output_limit_tests;
#[cfg(test)]
mod provider_contract_tests;
#[cfg(test)]
mod resolution_tests;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod version_tests;
