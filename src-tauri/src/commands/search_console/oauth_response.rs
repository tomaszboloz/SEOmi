use super::models::TokenResponse;
use crate::utils::provider_json::{read_provider_json, TOKEN_JSON_LIMIT};

pub(super) async fn oauth_response(response: reqwest::Response) -> Result<TokenResponse, String> {
    let body = read_provider_json(response, TOKEN_JSON_LIMIT, "Google OAuth").await?;
    let token: TokenResponse = serde_json::from_value(body)
        .map_err(|_| "Google returned an invalid OAuth response.".to_string())?;
    if token
        .access_token
        .as_ref()
        .map_or(true, |value| value.trim().is_empty())
    {
        return Err("Google OAuth returned no access token. Connect your account again.".into());
    }
    Ok(token)
}
