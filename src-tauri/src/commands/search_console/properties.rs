use super::credentials::validate_client_id;
use super::models::{GscSiteProperty, SitesResponse};
use super::tokens::refresh_access_token;
use tokio::time::Duration;

const SITES_URL: &str = "https://searchconsole.googleapis.com/webmasters/v3/sites";

pub(super) async fn site_properties(
    client: &reqwest::Client,
    access_token: &str,
) -> Result<Vec<GscSiteProperty>, String> {
    let response = client
        .get(SITES_URL)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|error| format!("Unable to retrieve Search Console properties: {error}"))?;
    let status = response.status();
    let body = response
        .json::<SitesResponse>()
        .await
        .map_err(|error| format!("Google returned an invalid property list: {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "Search Console property request returned status {status}."
        ));
    }
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
        .map_err(|error| error.to_string())?;
    let access_token = refresh_access_token(&client, &project_id, &client_id).await?;
    site_properties(&client, &access_token).await
}
