use super::provider_error_code::{known_reason, ERROR_BODY_LIMIT};
use reqwest::Response;
use serde_json::Value;

pub const REPORT_JSON_LIMIT: usize = 10 * 1024 * 1024;
pub const TOKEN_JSON_LIMIT: usize = 64 * 1024;

/// The fixed reason a failed response names, read from a bounded prefix of its body.
async fn failure_reason(response: &mut Response) -> Option<(&'static str, &'static str)> {
    let mut bytes = Vec::new();
    while let Ok(Some(chunk)) = response.chunk().await {
        if chunk.len() > ERROR_BODY_LIMIT.saturating_sub(bytes.len()) {
            return None;
        }
        bytes.extend_from_slice(&chunk);
    }
    known_reason(&serde_json::from_slice(&bytes).ok()?)
}

/// Bound decoded response bytes before parsing; provider text never becomes an
/// error. A failure may carry one of the fixed reasons of `provider_error_code`.
pub async fn read_provider_json(
    mut response: Response,
    limit: usize,
    provider: &'static str,
) -> Result<Value, String> {
    let status = response.status();
    if !status.is_success() {
        return Err(match failure_reason(&mut response).await {
            Some((code, hint)) => {
                format!("{provider} HTTP {status}: request failed ({code}). {hint}")
            }
            None => format!("{provider} HTTP {status}: request failed."),
        });
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| format!("{provider} response could not be read."))?
    {
        if chunk.len() > limit.saturating_sub(bytes.len()) {
            return Err(format!(
                "{provider} response exceeds the {limit} byte safety limit."
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    let body: Value = serde_json::from_slice(&bytes)
        .map_err(|_| format!("{provider} returned an invalid response."))?;
    if !body.is_object() {
        return Err(format!("{provider} returned an invalid response."));
    }
    Ok(body)
}

#[cfg(test)]
#[path = "provider_json_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "provider_json_reason_tests.rs"]
mod reason_tests;
