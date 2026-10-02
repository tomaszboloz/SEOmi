use super::models::{AnalyticsRows, GscPerformanceFilters};
use super::requests::{analytics_page_request, next_start_row, site_path, SEARCH_ROW_MAX};
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
    let endpoint = format!(
        "https://searchconsole.googleapis.com/webmasters/v3/sites/{}/searchAnalytics/query",
        site_path(site_url)
    );
    let mut rows = Vec::new();
    let mut start_row = 0usize;
    loop {
        let (payload, requested_rows) =
            analytics_page_request(start, end, dimension, start_row, filters);
        let body = token_json(access_token, client.post(&endpoint).json(&payload)).await?;
        let page = body
            .get("rows")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let returned_rows = page.len();
        rows.extend(page);
        if dimension.is_none() {
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
