use super::models::GscPerformanceFilters;
use super::requests::SEARCH_ROW_MAX;
use serde_json::{json, Value};

fn metric(row: &Value, index: usize) -> f64 {
    row.get(["clicks", "impressions", "ctr", "position"][index])
        .and_then(Value::as_f64)
        .unwrap_or(0.0)
}

fn map_analytics_row(row: &Value, key_name: &str) -> Value {
    let mut result = json!({
        "clicks": metric(row, 0), "impressions": metric(row, 1),
        "ctr": (metric(row, 2) * 100.0 * 10.0).round() / 10.0,
        "position": (metric(row, 3) * 10.0).round() / 10.0,
    });
    result[key_name] = row
        .get("keys")
        .and_then(Value::as_array)
        .and_then(|keys| keys.first())
        .cloned()
        .unwrap_or(Value::String(String::new()));
    result
}

#[allow(clippy::too_many_arguments)]
pub(super) fn map_performance(
    site_url: &str,
    start: &str,
    end: &str,
    queries: &[Value],
    pages: &[Value],
    totals: &[Value],
    daily: &[Value],
    filters: &GscPerformanceFilters,
    queries_may_be_truncated: bool,
    pages_may_be_truncated: bool,
) -> Value {
    let total = totals.first().cloned().unwrap_or_else(|| json!({}));
    let mut daily_rows = daily
        .iter()
        .map(|row| map_analytics_row(row, "date"))
        .collect::<Vec<_>>();
    daily_rows.sort_by(|left, right| left["date"].as_str().cmp(&right["date"].as_str()));
    json!({
        "site_url": site_url,
        "start_date": start,
        "end_date": end,
        "filters": filters,
        "total_clicks": metric(&total, 0),
        "total_impressions": metric(&total, 1),
        "avg_ctr": (metric(&total, 2) * 100.0 * 10.0).round() / 10.0,
        "avg_position": (metric(&total, 3) * 10.0).round() / 10.0,
        "queries": queries.iter().map(|row| map_analytics_row(row, "query")).collect::<Vec<_>>(),
        "pages": pages.iter().map(|row| map_analytics_row(row, "page")).collect::<Vec<_>>(),
        "daily": daily_rows,
        "queries_may_be_truncated": queries_may_be_truncated,
        "pages_may_be_truncated": pages_may_be_truncated,
        "daily_may_be_truncated": daily.len() >= SEARCH_ROW_MAX,
        "max_rows_per_dimension": SEARCH_ROW_MAX,
    })
}
