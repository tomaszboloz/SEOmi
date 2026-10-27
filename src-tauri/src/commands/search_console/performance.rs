use super::models::GscPerformanceFilters;
use super::{
    credentials::validate_client_id,
    dates::requested_date_range,
    filters::normalize_filters,
    performance_source,
    requests::site_path,
    session::{CredentialStore, NativeCredentialStore, TOKEN_ENDPOINT},
    tokens::refresh_access_token_with_store,
};
use serde_json::Value;
use tokio::time::Duration;

pub(super) async fn search_console_performance(
    project_id: String,
    client_id: String,
    site_url: String,
    start_date: Option<String>,
    end_date: Option<String>,
    filters: Option<GscPerformanceFilters>,
) -> Result<Value, String> {
    search_console_performance_with(
        project_id,
        client_id,
        site_url,
        start_date,
        end_date,
        filters,
        &NativeCredentialStore,
        TOKEN_ENDPOINT,
        None,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn search_console_performance_with(
    project_id: String,
    client_id: String,
    site_url: String,
    start_date: Option<String>,
    end_date: Option<String>,
    filters: Option<GscPerformanceFilters>,
    store: &dyn CredentialStore,
    token_url: &str,
    endpoint_override: Option<&str>,
) -> Result<Value, String> {
    let client_id = validate_client_id(&client_id)?;
    if site_url.trim().is_empty() {
        return Err("Wybierz property Search Console.".into());
    }
    let client = performance_client(reqwest::Client::builder())?;
    let (start, end) = requested_date_range(start_date.as_deref(), end_date.as_deref())?;
    let filters = normalize_filters(filters)?;
    let access_token =
        refresh_access_token_with_store(&client, &project_id, &client_id, store, token_url).await?;
    let default_endpoint = format!(
        "https://searchconsole.googleapis.com/webmasters/v3/sites/{}/searchAnalytics/query",
        site_path(&site_url)
    );
    let endpoint = endpoint_override.unwrap_or(&default_endpoint);
    search_console_performance_at(
        &client,
        &access_token,
        endpoint,
        &site_url,
        &start,
        &end,
        &filters,
    )
    .await
}

pub(super) async fn search_console_performance_at(
    client: &reqwest::Client,
    access_token: &str,
    endpoint: &str,
    site_url: &str,
    start: &str,
    end: &str,
    filters: &GscPerformanceFilters,
) -> Result<Value, String> {
    performance_source::run(
        client,
        access_token,
        Some(endpoint),
        site_url,
        start,
        end,
        filters,
    )
    .await
}

pub(super) fn performance_client(
    builder: reqwest::ClientBuilder,
) -> Result<reqwest::Client, String> {
    builder
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())
}
