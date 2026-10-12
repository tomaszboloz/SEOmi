use super::transport;
use serde::Serialize;
use serde_json::Value;

const MAX_MODELS: usize = 300;

#[derive(Debug, Serialize)]
pub struct AiModelOption {
    pub id: String,
    pub label: String,
}

pub(super) fn openai_models(body: &Value) -> Vec<AiModelOption> {
    body["data"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|model| {
            let id = model["id"].as_str()?.to_string();
            let excluded = [
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
            ]
            .iter()
            .any(|part| id.to_ascii_lowercase().contains(part));
            let chat = id.starts_with("gpt-") || id.starts_with('o') || id.starts_with("chatgpt-");
            (!excluded && chat).then(|| AiModelOption {
                label: id.clone(),
                id,
            })
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
            (id.starts_with("gemini") && methods.iter().any(|method| method == "generateContent"))
                .then(|| AiModelOption {
                    label: model["displayName"].as_str().unwrap_or(&id).to_string(),
                    id,
                })
        })
        .collect()
}

pub async fn list(provider: &str) -> Result<Vec<AiModelOption>, String> {
    let (_, body) = transport::send(provider, "", None, false).await?;
    let mut models = match provider {
        "openai" => openai_models(&body),
        "claude" => claude_models(&body),
        "gemini" => gemini_models(&body),
        _ => return Err("Unsupported AI provider.".into()),
    };
    models.truncate(MAX_MODELS);
    Ok(models)
}
