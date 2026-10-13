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
    configured_key(entry.get_password())
}

fn configured_key<E>(stored: Result<String, E>) -> Result<String, String> {
    let key = stored.map_err(|_| "Unable to read the AI provider credential.".to_string())?;
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

fn models_url() -> Url {
    Url::parse(GEMINI_MODELS).expect("the Gemini models endpoint is a valid URL")
}

pub(super) fn gemini_url(model: &str, key: &str) -> Result<String, String> {
    let mut url = models_url();
    {
        let mut segments = url
            .path_segments_mut()
            .expect("an https base URL has path segments");
        // Gemini's method suffix belongs to the model path segment. Adding it
        // as a second segment would produce `/models/<model>/:generateContent`
        // and the API responds with a 404.
        segments.push(&format!("{model}:generateContent"));
    }
    url.query_pairs_mut().append_pair("key", key);
    Ok(url.into())
}

fn gemini_models_url(key: &str) -> Result<String, String> {
    let mut url = models_url();
    // The default page holds 50 models; one request asks for the whole list.
    url.query_pairs_mut()
        .append_pair("pageSize", "1000")
        .append_pair("key", key);
    Ok(url.into())
}

#[cfg(test)]
mod key_tests;
#[cfg(test)]
mod tests;
