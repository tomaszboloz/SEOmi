use super::models::{AnalyticsRows, GscPerformanceFilters};
use super::requests::{analytics_dimensions_request, next_start_row, site_path, SEARCH_ROW_MAX};
use super::tokens::token_json;
use serde_json::Value;

pub(super) async fn performance_rows(
    client: &reqwest::Client,
    access_token: &str,
    site_url: &str,
    start: &str,
    end: &str,
    dimension: Option<&str>,
    filters: &GscPerformanceFilters,
) -> Result<AnalyticsRows, String> {
    performance_dimensions(
        client,
        access_token,
        site_url,
        start,
        end,
        &dimension.into_iter().collect::<Vec<_>>(),
        filters,
    )
    .await
}

pub(super) async fn performance_dimensions(
    client: &reqwest::Client,
    access_token: &str,
    site_url: &str,
    start: &str,
    end: &str,
    dimensions: &[&str],
    filters: &GscPerformanceFilters,
) -> Result<AnalyticsRows, String> {
    let endpoint = format!(
        "https://searchconsole.googleapis.com/webmasters/v3/sites/{}/searchAnalytics/query",
        site_path(site_url)
    );
    performance_dimensions_at(
        client,
        access_token,
        &endpoint,
        start,
        end,
        dimensions,
        filters,
    )
    .await
}

#[cfg(test)]
pub(super) async fn performance_rows_at(
    client: &reqwest::Client,
    access_token: &str,
    endpoint: &str,
    start: &str,
    end: &str,
    dimension: Option<&str>,
    filters: &GscPerformanceFilters,
) -> Result<AnalyticsRows, String> {
    performance_dimensions_at(
        client,
        access_token,
        endpoint,
        start,
        end,
        &dimension.into_iter().collect::<Vec<_>>(),
        filters,
    )
    .await
}

pub(super) async fn performance_dimensions_at(
    client: &reqwest::Client,
    access_token: &str,
    endpoint: &str,
    start: &str,
    end: &str,
    dimensions: &[&str],
    filters: &GscPerformanceFilters,
) -> Result<AnalyticsRows, String> {
    let mut rows = Vec::new();
    let mut start_row = 0usize;
    loop {
        let (payload, requested_rows) =
            analytics_dimensions_request(start, end, dimensions, start_row, filters);
        let body = token_json(access_token, client.post(endpoint).json(&payload)).await?;
        let page = body
            .get("rows")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let returned_rows = page.len();
        rows.extend(page);
        if dimensions.is_empty() {
            return Ok(AnalyticsRows {
                rows,
                may_be_truncated: false,
            });
        }
        let Some(next) = next_start_row(start_row, returned_rows, requested_rows) else {
            return Ok(AnalyticsRows {
                may_be_truncated: start_row + returned_rows >= SEARCH_ROW_MAX
                    && returned_rows == requested_rows,
                rows,
            });
        };
        start_row = next;
    }
}
