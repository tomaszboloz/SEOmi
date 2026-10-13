use super::{credentials::validate_client_id, tokens::authorized_json};
use serde_json::{json, Value};
use tokio::time::Duration;
use url::Url;

const INSPECTION_ENDPOINT: &str =
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

pub(super) async fn inspect_search_console_url(
    project_id: String,
    client_id: String,
    site_url: String,
    inspection_url: String,
) -> Result<Value, String> {
    let client_id = validate_client_id(&client_id)?;
    let parsed = Url::parse(&inspection_url)
        .map_err(|_| "Enter a complete HTTP or HTTPS URL for inspection.".to_string())?;
    if !is_inspectable(parsed.scheme(), parsed.host_str()) {
        return Err("Enter a complete HTTP or HTTPS URL for inspection.".into());
    }
    let client = inspection_client(
        reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build(),
    )?;
    authorized_json(
        &client,
        &project_id,
        &client_id,
        inspection_request(&client, INSPECTION_ENDPOINT, &site_url, &parsed),
    )
    .await
}

pub(super) fn is_inspectable(scheme: &str, host: Option<&str>) -> bool {
    ["http", "https"].contains(&scheme) && host.is_some()
}

pub(super) fn inspection_client(
    built: reqwest::Result<reqwest::Client>,
) -> Result<reqwest::Client, String> {
    built.map_err(|error| error.to_string())
}

pub(super) fn inspection_request(
    client: &reqwest::Client,
    endpoint: &str,
    site_url: &str,
    inspection_url: &Url,
) -> reqwest::RequestBuilder {
    client.post(endpoint).json(&json!({
        "inspectionUrl": inspection_url.as_str(),
        "siteUrl": site_url,
        "languageCode": "pl-PL"
    }))
}
