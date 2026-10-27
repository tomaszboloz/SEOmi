use super::transport;
use reqwest::StatusCode;
use serde::Serialize;
use serde_json::Value;

const MAX_MODELS: usize = 300;

#[derive(Debug, Serialize)]
pub struct AiModelOption {
    pub id: String,
    pub label: String,
}

/// Families that cannot answer a chat completion. The last four are listed
/// by the API but served only by other endpoints (`-pro`, `codex`,
/// `gpt-live`) or by the legacy completions endpoint (`instruct`).
const OPENAI_NON_CHAT: [&str; 17] = [
    "embedding",
    "whisper",
    "tts",
    "dall-e",
    "image",
    "audio",
    "realtime",
    "transcribe",
    "moderation",
    "search",
    "davinci",
    "babbage",
    "computer-use",
    "-pro",
    "codex",
    "gpt-live",
    "instruct",
];
const GEMINI_NON_TEXT: [&str; 6] = [
    "tts",
    "image",
    "transcribe",
    "embedding",
    "robotics",
    "computer-use",
];

fn names_any(id: &str, parts: &[&str]) -> bool {
    let id = id.to_ascii_lowercase();
    parts.iter().any(|part| id.contains(part))
}

/// Chat models, newest first; the API returns them in no particular order.
pub(super) fn openai_models(body: &Value) -> Vec<AiModelOption> {
    let mut dated: Vec<(i64, String)> = body["data"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|model| {
            let id = model["id"].as_str()?.to_string();
            let chat = id.starts_with("gpt-") || id.starts_with('o') || id.starts_with("chatgpt-");
            let created = model["created"].as_i64().unwrap_or(0);
            (chat && !names_any(&id, &OPENAI_NON_CHAT)).then_some((created, id))
        })
        .collect();
    dated.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| left.1.cmp(&right.1)));
    dated
        .into_iter()
        .map(|(_, id)| AiModelOption {
            label: id.clone(),
            id,
        })
        .collect()
}

pub(super) fn claude_models(body: &Value) -> Vec<AiModelOption> {
    body["data"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|model| {
            let id = model["id"].as_str()?.to_string();
            let label = model["display_name"]
                .as_str()
                .filter(|value| !value.is_empty())
                .unwrap_or(&id)
                .to_string();
            Some(AiModelOption { id, label })
        })
        .collect()
}

pub(super) fn gemini_models(body: &Value) -> Vec<AiModelOption> {
    body["models"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|model| {
            let raw = model["name"].as_str()?;
            let id = raw.strip_prefix("models/").unwrap_or(raw).to_string();
            let methods = model["supportedGenerationMethods"].as_array()?;
            let text = id.starts_with("gemini") && !names_any(&id, &GEMINI_NON_TEXT);
            (text && methods.iter().any(|method| method == "generateContent")).then(|| {
                AiModelOption {
                    label: model["displayName"].as_str().unwrap_or(&id).to_string(),
                    id,
                }
            })
        })
        .collect()
}

pub async fn list(provider: &str) -> Result<Vec<AiModelOption>, String> {
    select_models(provider, transport::send(provider, "", None, false).await)
}

pub(super) fn select_models(
    provider: &str,
    sent: Result<(StatusCode, Value), String>,
) -> Result<Vec<AiModelOption>, String> {
    let (_, body) = sent?;
    let mut models = match provider {
        "openai" => openai_models(&body),
        "claude" => claude_models(&body),
        "gemini" => gemini_models(&body),
        _ => return Err("Unsupported AI provider.".into()),
    };
    models.truncate(MAX_MODELS);
    Ok(models)
}
