use super::credentials::{client_secret_key, refresh_token_key};
use super::models::TokenResponse;
use super::oauth_response::oauth_response;
use crate::commands::settings::secret_entry;
use crate::utils::provider_json::{read_provider_json, REPORT_JSON_LIMIT};
use serde_json::Value;

const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

pub(super) async fn exchange_code(
    client: &reqwest::Client,
    client_id: &str,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
    client_secret: Option<&str>,
) -> Result<TokenResponse, String> {
    let mut form = vec![
        ("client_id", client_id.to_string()),
        ("code", code.to_string()),
        ("code_verifier", verifier.to_string()),
        ("grant_type", "authorization_code".to_string()),
        ("redirect_uri", redirect_uri.to_string()),
    ];
    if let Some(secret) = client_secret.filter(|value| !value.trim().is_empty()) {
        form.push(("client_secret", secret.to_string()));
    }
    let response = client
        .post(TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(|_| "Unable to exchange the Google OAuth code.".to_string())?;
    oauth_response(response).await
}

pub(super) async fn refresh_access_token(
    client: &reqwest::Client,
    project_id: &str,
    client_id: &str,
) -> Result<String, String> {
    let key = refresh_token_key(project_id)?;
    let refresh_token = secret_entry(&key)?.get_password().map_err(|_| {
        "Search Console token is missing from the OS credential store. Connect your account again."
            .to_string()
    })?;
    let client_secret = client_secret_key(project_id)
        .ok()
        .and_then(|key| secret_entry(&key).ok())
        .and_then(|entry| entry.get_password().ok());
    let mut form = vec![
        ("client_id", client_id.to_string()),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token".to_string()),
    ];
    if let Some(secret) = client_secret.filter(|value| !value.trim().is_empty()) {
        form.push(("client_secret", secret));
    }
    let response = client
        .post(TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(|_| "Unable to refresh the Google token.".to_string())?;
    Ok(oauth_response(response).await?.access_token.unwrap())
}

pub(super) async fn token_json(
    access_token: &str,
    request: reqwest::RequestBuilder,
) -> Result<Value, String> {
    let response = request
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|_| "Google Search Console request failed.".to_string())?;
    read_provider_json(response, REPORT_JSON_LIMIT, "Google Search Console").await
}

pub(super) async fn authorized_json(
    client: &reqwest::Client,
    project_id: &str,
    client_id: &str,
    request: reqwest::RequestBuilder,
) -> Result<Value, String> {
    let access_token = refresh_access_token(client, project_id, client_id).await?;
    token_json(&access_token, request).await
}
