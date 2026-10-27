use super::{gemini_models_url, gemini_url};
use reqwest::{Client, ClientBuilder, Method, RequestBuilder, StatusCode};
use serde_json::{json, Value};
use std::time::Duration;
use url::Url;

mod dispatch;
pub(crate) use dispatch::{generate, send, test_connection};

const OPENAI_MODELS: &str = "https://api.openai.com/v1/models";
const OPENAI_CHAT: &str = "https://api.openai.com/v1/chat/completions";
// One page of up to 1000 models; the default page holds only 20.
const CLAUDE_MODELS: &str = "https://api.anthropic.com/v1/models?limit=1000";
const CLAUDE_MESSAGES: &str = "https://api.anthropic.com/v1/messages";

pub(crate) fn connection_succeeded(status: StatusCode, body_valid: bool) -> bool {
    status.is_success() && body_valid
}

/// Return a bounded status-only error. Provider error bodies may contain
/// credentials echoed by an upstream proxy or other sensitive diagnostics, so
/// generation and model discovery reject before consuming those bodies.
pub(crate) fn provider_status_error(status: StatusCode) -> String {
    format!("AI provider request failed with HTTP {}.", status.as_u16())
}

fn network_client(builder: ClientBuilder) -> Result<Client, String> {
    builder
        .timeout(Duration::from_secs(150))
        .build()
        .map_err(|_| "Unable to initialize the AI network client.".to_string())
}

/// Point a live provider endpoint at another origin, keeping path and query.
fn retarget(url: String, origin: Option<&str>) -> String {
    let Some(origin) = origin else { return url };
    let live = Url::parse(&url).expect("provider endpoints are valid URLs");
    format!("{origin}{}?{}", live.path(), live.query().unwrap_or(""))
}

/// No temperature is sent: reasoning models (gpt-5, gpt-6, o-series) accept
/// only the default and answer any other value with HTTP 400.
fn openai_chat(model: &str, prompt: &str, suggestions: bool) -> Value {
    let mut body = json!({"model": model, "messages": [{"role": "user", "content": prompt}]});
    if suggestions {
        body["response_format"] = json!({"type": "json_object"});
    }
    body
}

#[cfg(test)]
fn request(
    provider: &str,
    key: &str,
    model: &str,
    prompt: Option<&str>,
    suggestions: bool,
) -> Result<RequestBuilder, String> {
    request_at(
        None,
        Client::builder(),
        provider,
        key,
        (model, prompt, suggestions),
    )
}

fn request_at(
    origin: Option<&str>,
    client: ClientBuilder,
    provider: &str,
    key: &str,
    (model, prompt, suggestions): (&str, Option<&str>, bool),
) -> Result<RequestBuilder, String> {
    let client = network_client(client)?;
    let (method, url, body) = match (provider, prompt) {
        ("openai", None) => (Method::GET, OPENAI_MODELS.to_string(), None),
        ("openai", Some(prompt)) => (
            Method::POST,
            OPENAI_CHAT.to_string(),
            Some(openai_chat(model, prompt, suggestions)),
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
    let mut builder = client.request(method, retarget(url, origin));
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

#[cfg(test)]
mod tests;
