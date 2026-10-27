use super::mapping::{map_joint_rows, map_performance};
use super::models::GscPerformanceFilters;
use serde_json::json;

#[test]
fn negative_metrics_are_rejected_in_aggregates_and_joint_rows() {
    let negative = json!({"clicks": -1.0, "impressions": 1.0, "ctr": 0.5, "position": 1.0});
    let filters = GscPerformanceFilters::default();
    let error = map_performance(
        "https://e.test/",
        "2026-01-01",
        "2026-01-02",
        &[],
        &[],
        &[negative],
        &[],
        &filters,
        false,
        false,
    )
    .unwrap_err();
    assert!(error.contains("invalid Search Console metrics"));
    let row = json!({"keys": ["q", "p"], "clicks": -1.0, "impressions": 1.0, "ctr": 0.5, "position": 1.0});
    assert!(map_joint_rows(&[row]).is_err());
}

fn good_total() -> serde_json::Value {
    json!({"clicks": 1.0, "impressions": 2.0, "ctr": 0.5, "position": 3.0})
}

fn map(
    queries: &[serde_json::Value],
    pages: &[serde_json::Value],
    totals: &[serde_json::Value],
    daily: &[serde_json::Value],
) -> Result<serde_json::Value, String> {
    map_performance(
        "https://e.test/",
        "2026-01-01",
        "2026-01-02",
        queries,
        pages,
        totals,
        daily,
        &GscPerformanceFilters::default(),
        false,
        false,
    )
}

#[test]
fn aggregate_and_dimension_rows_are_validated_before_mapping() {
    assert_eq!(
        map(&[], &[], &[], &[]).unwrap_err(),
        "Google returned no aggregate Search Console metrics."
    );
    assert_eq!(
        map(&[], &[], &[good_total(), good_total()], &[]).unwrap_err(),
        "Google returned multiple aggregate Search Console rows."
    );
    let bad = json!({"keys": [], "clicks": 1.0, "impressions": 1.0, "ctr": 0.5, "position": 1.0});
    let totals = [good_total()];
    assert_eq!(
        map(&[], &[], &totals, std::slice::from_ref(&bad)).unwrap_err(),
        "Google returned an invalid date row."
    );
    assert_eq!(
        map(std::slice::from_ref(&bad), &[], &totals, &[]).unwrap_err(),
        "Google returned an invalid query row."
    );
    assert_eq!(
        map(&[], std::slice::from_ref(&bad), &totals, &[]).unwrap_err(),
        "Google returned an invalid page row."
    );
}
