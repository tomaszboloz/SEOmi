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
