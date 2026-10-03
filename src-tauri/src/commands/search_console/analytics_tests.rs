use super::{
    filters::normalize_filters,
    mapping::map_performance,
    models::GscPerformanceFilters,
    requests::{analytics_page_request, next_start_row, SEARCH_ROW_PAGE_SIZE},
};
use serde_json::json;

#[test]
fn maps_search_analytics_contract_without_inventing_rows() {
    let output = map_performance(
        "sc-domain:example.com",
        "2026-09-01",
        "2026-09-28",
        &[json!({"keys":["seo tools"],"clicks":12,"impressions":200,"ctr":0.06,"position":4.25})],
        &[
            json!({"keys":["https://example.com/"],"clicks":8,"impressions":160,"ctr":0.05,"position":3.5}),
        ],
        &[json!({"clicks":12,"impressions":200,"ctr":0.06,"position":4.25})],
        &[
            json!({"keys":["2026-09-02"],"clicks":2,"impressions":25,"ctr":0.08,"position":4.75}),
            json!({"keys":["2026-09-01"],"clicks":3,"impressions":50,"ctr":0.06,"position":4.25}),
        ],
        &GscPerformanceFilters::default(),
        false,
        false,
    );
    assert_eq!(output["avg_ctr"], 6.0);
    assert_eq!(output["avg_position"], 4.3);
    assert_eq!(output["queries"][0]["query"], "seo tools");
    assert_eq!(output["queries"][0]["ctr"], 6.0);
    assert_eq!(output["pages"][0]["page"], "https://example.com/");
    assert_eq!(output["pages"][0]["clicks"], 8.0);
    assert_eq!(output["queries_may_be_truncated"], false);
    assert_eq!(output["filters"], json!({}));
    assert_eq!(output["daily"][0]["date"], "2026-09-01");
    assert_eq!(output["daily"][0]["clicks"], 3.0);
    assert_eq!(output["daily"][1]["date"], "2026-09-02");
}

#[test]
fn analytics_pagination_uses_start_row_and_stops_at_google_response_cap() {
    assert_eq!(SEARCH_ROW_PAGE_SIZE, 10_000);
    assert_eq!(
        next_start_row(0, SEARCH_ROW_PAGE_SIZE, SEARCH_ROW_PAGE_SIZE),
        Some(10_000)
    );
    assert_eq!(
        next_start_row(10_000, SEARCH_ROW_PAGE_SIZE, SEARCH_ROW_PAGE_SIZE),
        Some(20_000)
    );
    assert_eq!(next_start_row(20_000, 5_000, 5_000), None);
    assert_eq!(next_start_row(0, 12, SEARCH_ROW_PAGE_SIZE), None);
    let filters = GscPerformanceFilters {
        search_type: Some("web".into()),
        device: Some("MOBILE".into()),
        country: Some("pol".into()),
    };
    let (request, requested) =
        analytics_page_request("2026-08-01", "2026-08-28", Some("query"), 20_000, &filters);
    assert_eq!(requested, 5_000);
    assert_eq!(request["rowLimit"], 5_000);
    assert_eq!(request["startRow"], 20_000);
    assert_eq!(request["dimensions"][0], "query");
    assert_eq!(request["type"], "web");
    assert_eq!(
        request["dimensionFilterGroups"][0]["filters"][0]["expression"],
        "MOBILE"
    );
    assert_eq!(
        request["dimensionFilterGroups"][0]["filters"][1]["expression"],
        "pol"
    );
}

#[test]
fn validates_and_normalizes_real_search_console_filter_values() {
    let filters = normalize_filters(Some(GscPerformanceFilters {
        search_type: Some(" web ".into()),
        device: Some("mobile".into()),
        country: Some(" POL ".into()),
    }))
    .unwrap();
    assert_eq!(filters.search_type.as_deref(), Some("web"));
    assert_eq!(filters.device.as_deref(), Some("MOBILE"));
    assert_eq!(filters.country.as_deref(), Some("pol"));
    assert!(normalize_filters(Some(GscPerformanceFilters {
        country: Some("pl".into()),
        ..Default::default()
    }))
    .is_err());
    assert!(normalize_filters(Some(GscPerformanceFilters {
        device: Some("PHONE".into()),
        ..Default::default()
    }))
    .is_err());
}
