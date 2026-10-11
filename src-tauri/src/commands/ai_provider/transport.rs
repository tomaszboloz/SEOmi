use super::super::settings::secret_entry;
use url::Url;

mod request;
#[cfg(test)]
pub(super) use request::{connection_succeeded, provider_status_error};
pub(crate) use request::{generate, send, test_connection};

const GEMINI_MODELS: &str = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_PROMPT_BYTES: usize = 1024 * 1024;

fn key_name(provider: &str) -> Result<&'static str, String> {
    match provider {
        "openai" => Ok("openai_api_key"),
        "claude" => Ok("claude_api_key"),
        "gemini" => Ok("gemini_api_key"),
        _ => Err("Unsupported AI provider.".into()),
    }
}

fn provider_key(provider: &str) -> Result<String, String> {
    let entry = secret_entry(key_name(provider)?)?;
    let key = entry
        .get_password()
        .map_err(|_| "Unable to read the AI provider credential.".to_string())?;
    if key.trim().is_empty() {
        return Err("AI provider credential is not configured.".into());
    }
    Ok(key)
}

fn checked_model(model: &str) -> Result<String, String> {
    let model = model.trim();
    if model.is_empty() || model.len() > 200 || model.chars().any(|c| c.is_control()) {
        return Err("Invalid AI model.".into());
    }
    Ok(model.into())
}

fn checked_prompt(prompt: &str) -> Result<(), String> {
    if prompt.is_empty() || prompt.len() > MAX_PROMPT_BYTES {
        return Err("Invalid AI prompt.".into());
    }
    Ok(())
}

pub(super) fn gemini_url(model: &str, key: &str) -> Result<String, String> {
    let mut url =
        Url::parse(GEMINI_MODELS).map_err(|_| "Unable to build AI provider URL.".to_string())?;
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| "Unable to build AI provider URL.".to_string())?;
        // Gemini's method suffix belongs to the model path segment. Adding it
        // as a second segment would produce `/models/<model>/:generateContent`
        // and the API responds with a 404.
        segments.push(&format!("{model}:generateContent"));
    }
    url.query_pairs_mut().append_pair("key", key);
    Ok(url.into())
}

fn gemini_models_url(key: &str) -> Result<String, String> {
    let mut url =
        Url::parse(GEMINI_MODELS).map_err(|_| "Unable to build AI provider URL.".to_string())?;
    url.query_pairs_mut().append_pair("key", key);
    Ok(url.into())
}
