use super::{credentials::validate_client_id, tokens::authorized_json};
use serde_json::{json, Value};
use tokio::time::Duration;
use url::Url;

pub(super) async fn inspect_search_console_url(
    project_id: String,
    client_id: String,
    site_url: String,
    inspection_url: String,
) -> Result<Value, String> {
    let client_id = validate_client_id(&client_id)?;
    let parsed = Url::parse(&inspection_url)
        .map_err(|_| "Enter a complete HTTP or HTTPS URL for inspection.".to_string())?;
    if !["http", "https"].contains(&parsed.scheme()) || parsed.host_str().is_none() {
        return Err("Enter a complete HTTP or HTTPS URL for inspection.".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let endpoint = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
    authorized_json(
        &client,
        &project_id,
        &client_id,
        client.post(endpoint).json(&json!({
            "inspectionUrl": parsed.as_str(), "siteUrl": site_url, "languageCode": "pl-PL"
        })),
    )
    .await
}
