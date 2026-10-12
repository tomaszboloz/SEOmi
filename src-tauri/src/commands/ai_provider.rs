mod models;
mod transport;

use models::AiModelOption;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AiConnectionResult {
    pub success: bool,
    pub status: Option<u16>,
}

#[tauri::command]
pub async fn ai_generate_text(
    provider: String,
    model: String,
    prompt: String,
) -> Result<String, String> {
    transport::generate(&provider, &model, &prompt, false).await
}

#[tauri::command]
pub async fn ai_generate_suggestions(
    provider: String,
    model: String,
    prompt: String,
) -> Result<String, String> {
    transport::generate(&provider, &model, &prompt, true).await
}

#[tauri::command]
pub async fn ai_list_models(provider: String) -> Result<Vec<AiModelOption>, String> {
    models::list(&provider).await
}

#[tauri::command]
pub async fn ai_test_connection(provider: String) -> Result<AiConnectionResult, String> {
    transport::test_connection(&provider).await
}

#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_commands;
#[cfg(test)]
mod tests_models;
