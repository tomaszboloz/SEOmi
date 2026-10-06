use super::credentials::{client_secret_key, refresh_token_key};
use crate::commands::settings::secret_entry;
use tokio::time::Duration;

const REVOKE_URL: &str = "https://oauth2.googleapis.com/revoke";

pub(super) async fn disconnect_search_console(project_id: String) -> Result<String, String> {
    let key = refresh_token_key(&project_id)?;
    let client_secret_key = client_secret_key(&project_id)?;
    match secret_entry(&client_secret_key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => (),
        Err(error) => {
            return Err(format!(
                "Unable to remove the Search Console client secret: {error}"
            ))
        }
    }
    let entry = secret_entry(&key)?;
    let refresh_token = match entry.get_password() {
        Ok(token) => Some(token),
        Err(keyring::Error::NoEntry) => None,
        Err(error) => return Err(format!("Unable to read the Search Console token: {error}")),
    };
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => (),
        Err(error) => {
            return Err(format!(
                "Unable to remove the Search Console token from the credential store: {error}"
            ))
        }
    }
    let Some(refresh_token) = refresh_token else {
        return Ok("The local Search Console token has already been removed.".into());
    };
    let client = reqwest::Client::builder().timeout(Duration::from_secs(10)).build().map_err(|error| format!("The token was removed locally, but unable to create the Google consent revocation client: {error}"))?;
    revoke_refresh_token(&client, &refresh_token).await
}

pub(super) async fn revoke_refresh_token(
    client: &reqwest::Client,
    refresh_token: &str,
) -> Result<String, String> {
    revoke_refresh_token_at(client, REVOKE_URL, refresh_token).await
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
