use super::credentials::{client_secret_key, refresh_token_key};
use crate::commands::settings::secret_entry;
use tokio::time::Duration;

const REVOKE_URL: &str = "https://oauth2.googleapis.com/revoke";

pub(super) async fn disconnect_search_console(project_id: String) -> Result<String, String> {
    disconnect_search_console_at(&project_id, REVOKE_URL).await
}

pub(super) async fn disconnect_search_console_at(
    project_id: &str,
    revoke_endpoint: &str,
) -> Result<String, String> {
    disconnect_search_console_internal(project_id, revoke_endpoint, delete_secret, read_secret)
        .await
}

fn delete_secret(key: &str) -> Result<(), String> {
    match secret_entry(key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn read_secret(key: &str) -> Result<Option<String>, String> {
    match secret_entry(key)?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub(super) async fn disconnect_search_console_internal<D, G>(
    project_id: &str,
    revoke_endpoint: &str,
    mut delete_entry: D,
    mut get_token: G,
) -> Result<String, String>
where
    D: FnMut(&str) -> Result<(), String>,
    G: FnMut(&str) -> Result<Option<String>, String>,
{
    let key = refresh_token_key(project_id)?;
    let client_secret_key = client_secret_key(project_id)?;
    delete_entry(&client_secret_key)
        .map_err(|error| format!("Unable to remove the Search Console client secret: {error}"))?;
    let refresh_token = get_token(&key)
        .map_err(|error| format!("Unable to read the Search Console token: {error}"))?;
    delete_entry(&key).map_err(|error| {
        format!("Unable to remove the Search Console token from the credential store: {error}")
    })?;
    let Some(refresh_token) = refresh_token else {
        return Ok("The local Search Console token has already been removed.".into());
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| format!("The token was removed locally, but unable to create the Google consent revocation client: {error}"))?;
    revoke_refresh_token_at(&client, revoke_endpoint, &refresh_token).await
}

pub(super) async fn revoke_refresh_token_at(
    client: &reqwest::Client,
    endpoint: &str,
    refresh_token: &str,
) -> Result<String, String> {
    match client.post(endpoint).form(&[("token", refresh_token)]).send().await {
        Ok(response) if response.status().is_success() => Ok("Search Console token removed from the app and Google authorization revoked.".into()),
        Ok(response) => Ok(format!("Token removed from the app, but Google did not confirm revocation (HTTP {}). Revoke SEOmi access in Google account settings too.", response.status())),
        Err(error) => Ok(format!("The token was removed from the app, but Google consent revocation could not be confirmed ({error}). Revoke SEOmi access in your Google account settings as well.")),
    }
}

#[cfg(test)]
#[path = "disconnect_error_tests.rs"]
mod disconnect_error_tests;
