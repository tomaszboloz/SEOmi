use super::models::GscPerformanceFilters;
use serde_json::{json, Value};

pub(super) const SEARCH_ROW_PAGE_SIZE: usize = 10_000;
pub(super) const SEARCH_ROW_MAX: usize = 25_000;

pub(super) fn site_path(site_url: &str) -> String {
    url::form_urlencoded::byte_serialize(site_url.as_bytes()).collect()
}

pub(super) fn next_start_row(
    start_row: usize,
    returned_rows: usize,
    requested_rows: usize,
) -> Option<usize> {
    let next = start_row.saturating_add(returned_rows);
    (returned_rows == requested_rows && next < SEARCH_ROW_MAX).then_some(next)
}

pub(super) fn analytics_page_request(
    start: &str,
    end: &str,
    dimension: Option<&str>,
    start_row: usize,
    filters: &GscPerformanceFilters,
) -> (Value, usize) {
    let requested_rows = SEARCH_ROW_PAGE_SIZE.min(SEARCH_ROW_MAX.saturating_sub(start_row));
    let mut payload = json!({"startDate": start, "endDate": end, "rowLimit": requested_rows, "startRow": start_row});
    if let Some(dimension) = dimension {
        payload["dimensions"] = json!([dimension]);
    }
    if let Some(search_type) = filters.search_type.as_deref() {
        payload["type"] = json!(search_type);
    }
    let mut dimension_filters = Vec::new();
    if let Some(device) = filters.device.as_deref() {
        dimension_filters
            .push(json!({"dimension": "device", "operator": "equals", "expression": device}));
    }
    if let Some(country) = filters.country.as_deref() {
        dimension_filters
            .push(json!({"dimension": "country", "operator": "equals", "expression": country}));
    }
    if !dimension_filters.is_empty() {
        payload["dimensionFilterGroups"] =
            json!([{"groupType": "and", "filters": dimension_filters}]);
    }
    (payload, requested_rows)
}
