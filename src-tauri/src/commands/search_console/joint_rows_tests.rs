use super::{
    mapping::{map_joint_rows, map_performance},
    models::GscPerformanceFilters,
    requests::analytics_dimensions_request,
    rows::performance_dimensions_at,
    rows_test_fixture::{client, fixture},
};
use serde_json::json;

#[test]
fn joint_request_keeps_order_dates_and_filters_without_cross_join() {
    let (request, size) = analytics_dimensions_request(
        "2026-09-01",
        "2026-09-28",
        &["query", "page"],
        10000,
        &Default::default(),
    );
    assert_eq!(size, 10000);
    assert_eq!(request["dimensions"], json!(["query", "page"]));
    assert_eq!(request["startRow"], 10000);
    assert_eq!(request["startDate"], "2026-09-01");
    assert_eq!(request["endDate"], "2026-09-28");
}

#[test]
fn joint_mapping_uses_only_observed_pairs_and_preserves_metrics() {
    let rows = vec![
        json!({"keys":["seo","https://fixture.test/a"],"clicks":0,"impressions":20,"ctr":0,"position":12.25}),
        json!({"keys":["seo","https://fixture.test/b"],"clicks":2,"impressions":40,"ctr":0.05,"position":10.12}),
    ];
    let output = map_joint_rows(&rows).unwrap();
    assert_eq!(output.len(), 2);
    assert_eq!(output[0]["query"], "seo");
    assert_eq!(output[0]["page"], "https://fixture.test/a");
    assert_eq!(output[0]["clicks"], 0.0);
    assert_eq!(output[0]["position"], 12.3);
    assert_eq!(output[1]["ctr"], 5.0);
    assert_eq!(
        map_joint_rows(&[]).unwrap(),
        Vec::<serde_json::Value>::new()
    );
}

#[test]
fn malformed_joint_rows_are_rejected_instead_of_inventing_pairs() {
    for row in [
        json!({}),
        json!({"keys":["q"]}),
        json!({"keys":[42,"url"]}),
        json!({"keys":["q",""]}),
        json!({"keys":["q","url","extra"]}),
    ] {
        assert!(map_joint_rows(&[row]).is_err());
    }
}

#[tokio::test]
async fn joint_transport_requests_both_dimensions_in_one_google_query() {
    let observed = json!({"keys":["seo","https://fixture.test/page"],"clicks":1,"impressions":10,"ctr":0.1,"position":2});
    let (endpoint, server) = fixture(vec![(200, json!({"rows":[observed.clone()]}))]).await;
    let result = performance_dimensions_at(
        &client(),
        "synthetic-token",
        &endpoint,
        "start",
        "end",
        &["query", "page"],
        &Default::default(),
    )
    .await
    .unwrap();
    assert_eq!(result.rows, vec![observed]);
    assert!(!result.may_be_truncated);
    let requests = server.await.unwrap();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0]["dimensions"], json!(["query", "page"]));
}

#[test]
fn joint_metrics_must_be_observed_finite_and_nonnegative() {
    for key in ["clicks", "impressions", "ctr", "position"] {
        for invalid in [json!(null), json!(-1), json!("unknown")] {
            let mut row = json!({"keys":["q","https://fixture.test"],"clicks":0,"impressions":0,"ctr":0,"position":0});
            row[key] = invalid;
            assert_eq!(
                map_joint_rows(&[row]).unwrap_err(),
                "Google returned invalid query/page metrics."
            );
        }
    }
}

#[test]
fn map_performance_rejects_blank_key_in_analytics_row() {
    let total = json!({"clicks": 10, "impressions": 100, "ctr": 0.1, "position": 2.0});
    let blank_query = json!({
        "keys": ["   "],
        "clicks": 1,
        "impressions": 10,
        "ctr": 0.1,
        "position": 1.0
    });
    let result = map_performance(
        "sc-domain:example.com",
        "2026-09-01",
        "2026-09-28",
        &[blank_query],
        &[],
        &[total],
        &[],
        &GscPerformanceFilters::default(),
        false,
        false,
    );
    assert!(result.unwrap_err().contains("invalid query row"));
}
