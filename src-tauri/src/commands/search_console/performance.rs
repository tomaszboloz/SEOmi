use super::models::GscPerformanceFilters;
use super::{
    credentials::validate_client_id, dates::requested_date_range, filters::normalize_filters,
    performance_source, requests::site_path, tokens::refresh_access_token,
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
    let client_id = validate_client_id(&client_id)?;
    if site_url.trim().is_empty() {
        return Err("Wybierz property Search Console.".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let (start, end) = requested_date_range(start_date.as_deref(), end_date.as_deref())?;
    let filters = normalize_filters(filters)?;
    let access_token = refresh_access_token(&client, &project_id, &client_id).await?;
    let endpoint = format!(
        "https://searchconsole.googleapis.com/webmasters/v3/sites/{}/searchAnalytics/query",
        site_path(&site_url)
    );
    search_console_performance_at(
        &client,
        &access_token,
        &endpoint,
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
