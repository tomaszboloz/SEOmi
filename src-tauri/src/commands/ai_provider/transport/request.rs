use super::{checked_model, checked_prompt, gemini_models_url, gemini_url, provider_key};
use crate::utils::provider_json::{read_provider_json, REPORT_JSON_LIMIT};
use reqwest::{Client, Method, RequestBuilder, StatusCode};
use serde_json::{json, Value};
use std::time::Duration;

const OPENAI_MODELS: &str = "https://api.openai.com/v1/models";
const OPENAI_CHAT: &str = "https://api.openai.com/v1/chat/completions";
const CLAUDE_MODELS: &str = "https://api.anthropic.com/v1/models";
const CLAUDE_MESSAGES: &str = "https://api.anthropic.com/v1/messages";

pub(crate) fn connection_succeeded(status: StatusCode, body_valid: bool) -> bool {
    status.is_success() && body_valid
}

fn request(
    provider: &str,
    key: &str,
    model: &str,
    prompt: Option<&str>,
    suggestions: bool,
) -> Result<RequestBuilder, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(150))
        .build()
        .map_err(|_| "Unable to initialize the AI network client.".to_string())?;
    let (method, url, body) = match (provider, prompt) {
        ("openai", None) => (Method::GET, OPENAI_MODELS.to_string(), None),
        ("openai", Some(prompt)) => (
            Method::POST,
            OPENAI_CHAT.to_string(),
            Some(
                json!({"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": if suggestions { 0.7 } else { 0.0 }, "response_format": if suggestions { json!({"type": "json_object"}) } else { Value::Null }}),
            ),
        ),
        ("claude", None) => (Method::GET, CLAUDE_MODELS.to_string(), None),
        ("claude", Some(prompt)) => (
            Method::POST,
            CLAUDE_MESSAGES.to_string(),
            Some(
                json!({"model": model, "max_tokens": 16_000, "messages": [{"role": "user", "content": prompt}]}),
            ),
        ),
        ("gemini", None) => (Method::GET, gemini_models_url(key)?, None),
        ("gemini", Some(prompt)) => (
            Method::POST,
            gemini_url(model, key)?,
            Some(
                json!({"contents": [{"parts": [{"text": prompt}]}], "generationConfig": if suggestions { json!({"responseMimeType": "application/json"}) } else { Value::Null }}),
            ),
        ),
        _ => return Err("Unsupported AI provider request.".into()),
    };
    let mut builder = client.request(method, url);
    if provider == "openai" {
        builder = builder.bearer_auth(key);
    }
    if provider == "claude" {
        builder = builder
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01");
    }
    if body.is_some() {
        builder = builder.header("Content-Type", "application/json");
    }
    Ok(match body {
        Some(body) => builder.json(&body),
        None => builder,
    })
}

pub(crate) async fn send(
    provider: &str,
    model: &str,
    prompt: Option<&str>,
    suggestions: bool,
) -> Result<(StatusCode, Value), String> {
    let key = provider_key(provider)?;
    if let Some(prompt) = prompt {
        checked_prompt(prompt)?;
    }
    let model = if prompt.is_some() {
        checked_model(model)?
    } else {
        String::new()
    };
    let response = request(provider, &key, &model, prompt, suggestions)?
        .send()
        .await
        .map_err(|_| "AI provider request failed.".to_string())?;
    let status = response.status();
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
    serde_json::to_string(&body).map_err(|_| "AI provider returned an invalid response.".into())
}

pub(crate) async fn test_connection(
    provider: &str,
) -> Result<super::super::AiConnectionResult, String> {
    let key = provider_key(provider)?;
    let (model, prompt) = if provider == "claude" {
        ("claude-haiku-4-5", Some("ping"))
    } else {
        ("", None)
    };
    let response = request(provider, &key, model, prompt, false)?
        .send()
        .await
        .map_err(|_| "AI provider request failed.".to_string())?;
    let status = response.status();
    let body_valid = read_provider_json(response, REPORT_JSON_LIMIT, "AI provider")
        .await
        .is_ok();
    Ok(super::super::AiConnectionResult {
        success: connection_succeeded(status, body_valid),
        status: Some(status.as_u16()),
    })
}
