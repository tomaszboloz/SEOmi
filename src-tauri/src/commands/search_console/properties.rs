use super::credentials::validate_client_id;
use super::models::{GscSiteProperty, SitesResponse};
use super::tokens::{refresh_access_token, token_json};
use tokio::time::Duration;

const SITES_URL: &str = "https://searchconsole.googleapis.com/webmasters/v3/sites";

pub(super) async fn site_properties(
    client: &reqwest::Client,
    access_token: &str,
) -> Result<Vec<GscSiteProperty>, String> {
    let body = token_json(access_token, client.get(SITES_URL)).await?;
    parse_properties(body)
}

pub(super) fn parse_properties(body: serde_json::Value) -> Result<Vec<GscSiteProperty>, String> {
    let body: SitesResponse = serde_json::from_value(body)
        .map_err(|_| "Google returned an invalid property list.".to_string())?;
    Ok(body.site_entry.unwrap_or_default())
}

pub(super) async fn list_search_console_properties(
    project_id: String,
    client_id: String,
) -> Result<Vec<GscSiteProperty>, String> {
    let client_id = validate_client_id(&client_id)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "Unable to initialize the Search Console client.".to_string())?;
    let access_token = refresh_access_token(&client, &project_id, &client_id).await?;
    site_properties(&client, &access_token).await
}
