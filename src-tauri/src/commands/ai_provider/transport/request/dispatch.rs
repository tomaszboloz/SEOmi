use super::super::{checked_model, checked_prompt, provider_key};
use super::{connection_succeeded, provider_status_error, request_at};
use crate::commands::ai_provider::AiConnectionResult;
use crate::utils::provider_json::{read_provider_json, REPORT_JSON_LIMIT};
use reqwest::{Client, StatusCode};
use serde_json::Value;

pub(crate) async fn send(
    provider: &str,
    model: &str,
    prompt: Option<&str>,
    suggestions: bool,
) -> Result<(StatusCode, Value), String> {
    let key = provider_key(provider)?;
    send_to(None, provider, &key, (model, prompt, suggestions)).await
}

pub(super) async fn send_to(
    origin: Option<&str>,
    provider: &str,
    key: &str,
    (model, prompt, suggestions): (&str, Option<&str>, bool),
) -> Result<(StatusCode, Value), String> {
    if let Some(prompt) = prompt {
        checked_prompt(prompt)?;
    }
    let model = if prompt.is_some() {
        checked_model(model)?
    } else {
        String::new()
    };
    let request = request_at(
        origin,
        Client::builder(),
        provider,
        key,
        (&model, prompt, suggestions),
    )?;
    let response = request
        .send()
        .await
        .map_err(|_| "AI provider request failed.".to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(provider_status_error(status));
    }
    let body = read_provider_json(response, REPORT_JSON_LIMIT, "AI provider").await?;
    Ok((status, body))
}

pub(crate) async fn generate(
    provider: &str,
    model: &str,
    prompt: &str,
    suggestions: bool,
) -> Result<String, String> {
    let (_, body) = send(provider, model, Some(prompt), suggestions).await?;
    Ok(body.to_string())
}

pub(crate) async fn test_connection(provider: &str) -> Result<AiConnectionResult, String> {
    let key = provider_key(provider)?;
    probe(None, provider, &key).await
}

pub(super) async fn probe(
    origin: Option<&str>,
    provider: &str,
    key: &str,
) -> Result<AiConnectionResult, String> {
    let (model, prompt) = if provider == "claude" {
        ("claude-haiku-4-5", Some("ping"))
    } else {
        ("", None)
    };
    let request = request_at(
        origin,
        Client::builder(),
        provider,
        key,
        (model, prompt, false),
    )?;
    let response = request
        .send()
        .await
        .map_err(|_| "AI provider request failed.".to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Ok(AiConnectionResult {
            success: false,
            status: Some(status.as_u16()),
        });
    }
    let body_valid = read_provider_json(response, REPORT_JSON_LIMIT, "AI provider")
        .await
        .is_ok();
    Ok(AiConnectionResult {
        success: connection_succeeded(status, body_valid),
        status: Some(status.as_u16()),
    })
}

#[cfg(test)]
mod tests;
