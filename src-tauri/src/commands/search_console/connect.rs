use super::credentials::{client_secret_key, refresh_token_key, validate_client_id};
use super::models::GscSiteProperty;
use super::{
    browser::send_browser_to, callback::receive_oauth_code, pkce::code_challenge,
    properties::site_properties, tokens::exchange_code,
};
use crate::commands::settings::secret_entry;
use tokio::{net::TcpListener, time::Duration};
use url::Url;
use uuid::Uuid;

const OAUTH_SCOPE: &str = "https://www.googleapis.com/auth/webmasters.readonly";

pub(super) async fn connect_search_console(
    project_id: String,
    client_id: String,
    client_secret: Option<String>,
) -> Result<Vec<GscSiteProperty>, String> {
    let client_id = validate_client_id(&client_id)?;
    let refresh_key = refresh_token_key(&project_id)?;
    let old_refresh_token = secret_entry(&refresh_key)
        .ok()
        .and_then(|entry| entry.get_password().ok());
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|error| format!("Unable to start the local OAuth callback: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Unable to determine the OAuth port: {error}"))?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/oauth2callback");
    let state = Uuid::new_v4().simple().to_string();
    let verifier = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let challenge = code_challenge(&verifier);
    let mut auth_url = Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .map_err(|error| error.to_string())?;
    auth_url
        .query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", OAUTH_SCOPE)
        .append_pair("state", &state)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent");
    send_browser_to(auth_url.as_str())?;
    let code = receive_oauth_code(listener, &state).await?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Unable to create the Google OAuth client: {error}"))?;
    let client_secret = client_secret
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            client_secret_key(&project_id)
                .ok()
                .and_then(|key| secret_entry(&key).ok())
                .and_then(|entry| entry.get_password().ok())
        });
    let token = exchange_code(
        &client,
        &client_id,
        &code,
        &verifier,
        &redirect_uri,
        client_secret.as_deref(),
    )
    .await?;
    let access_token = token
        .access_token
        .ok_or_else(|| "Google OAuth did not return an access token.".to_string())?;
    let refresh_token = token.refresh_token.or(old_refresh_token)
        .ok_or_else(|| "Google did not return a refresh token. Revoke SEOmi access in your Google account and connect again.".to_string())?;
    let properties = site_properties(&client, &access_token).await?;
    secret_entry(&refresh_key)?
        .set_password(&refresh_token)
        .map_err(|error| {
            format!(
                "Unable to save the Search Console token in the system credential store: {error}"
            )
        })?;
    if let Some(secret) = client_secret.filter(|value| !value.trim().is_empty()) {
        secret_entry(&client_secret_key(&project_id)?)?
            .set_password(&secret)
            .map_err(|error| format!("Unable to save the Search Console client secret: {error}"))?;
    }
    Ok(properties)
}
