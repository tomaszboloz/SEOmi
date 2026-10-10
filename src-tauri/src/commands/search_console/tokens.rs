use super::credentials::{client_secret_key, refresh_token_key};
use super::models::TokenResponse;
use super::oauth_response::oauth_response;
use super::session::{CredentialReadError, CredentialStore, NativeCredentialStore, TOKEN_ENDPOINT};
use crate::utils::provider_json::{read_provider_json, REPORT_JSON_LIMIT};
use serde_json::Value;

pub(super) async fn exchange_code_at(
    client: &reqwest::Client,
    token_url: &str,
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
        .post(token_url)
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
    let store = NativeCredentialStore;
    refresh_access_token_with_store(client, project_id, client_id, &store, TOKEN_ENDPOINT).await
}

pub(super) async fn refresh_access_token_with_store(
    client: &reqwest::Client,
    project_id: &str,
    client_id: &str,
    store: &dyn CredentialStore,
    token_url: &str,
) -> Result<String, String> {
    let key = refresh_token_key(project_id)?;
    let refresh_token = match store.read(&key) {
        Ok(Some(token)) => token,
        Ok(None) | Err(CredentialReadError::Value) => {
            return Err(
                "Search Console token is missing from the OS credential store. Connect your account again."
                    .into(),
            )
        }
        Err(CredentialReadError::Store(error)) => return Err(error),
    };
    let client_secret = client_secret_key(project_id)
        .ok()
        .and_then(|key| store.read(&key).ok().flatten());
    refresh_access_token_at(
        client,
        token_url,
        client_id,
        &refresh_token,
        client_secret.as_deref(),
    )
    .await
}

pub(super) async fn refresh_access_token_at(
    client: &reqwest::Client,
    token_url: &str,
    client_id: &str,
    refresh_token: &str,
    client_secret: Option<&str>,
) -> Result<String, String> {
    let mut form = vec![
        ("client_id", client_id.to_string()),
        ("refresh_token", refresh_token.to_string()),
        ("grant_type", "refresh_token".to_string()),
    ];
    if let Some(secret) = client_secret.filter(|value| !value.trim().is_empty()) {
        form.push(("client_secret", secret.to_string()));
    }
    let response = client
        .post(token_url)
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
    authorized_json_with_access_token(&access_token, request).await
}

pub(super) async fn authorized_json_with_access_token(
    access_token: &str,
    request: reqwest::RequestBuilder,
) -> Result<Value, String> {
    token_json(access_token, request).await
}
