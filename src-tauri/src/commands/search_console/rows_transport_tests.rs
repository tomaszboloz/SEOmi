use super::{
    models::GscPerformanceFilters,
    rows::performance_rows_at,
    rows_test_fixture::{client, fixture},
};
use serde_json::json;

#[tokio::test]
async fn short_page_preserves_rows_dates_dimension_and_filters() {
    let row = json!({"keys":["seo"],"clicks":0,"impressions":12});
    let (endpoint, server) = fixture(vec![(200, json!({"rows":[row.clone()]}))]).await;
    let filters = GscPerformanceFilters {
        search_type: Some("web".into()),
        device: Some("MOBILE".into()),
        country: Some("pol".into()),
    };
    let result = performance_rows_at(
        &client(),
        "synthetic-token",
        &endpoint,
        "2026-09-01",
        "2026-09-28",
        Some("query"),
        &filters,
    )
    .await
    .unwrap();
    assert_eq!(result.rows, vec![row]);
    assert!(!result.may_be_truncated);
    let requests = server.await.unwrap();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0]["dimensions"], json!(["query"]));
    assert_eq!(requests[0]["startDate"], "2026-09-01");
    assert_eq!(requests[0]["endDate"], "2026-09-28");
    assert_eq!(requests[0]["type"], "web");
    assert_eq!(
        requests[0]["dimensionFilterGroups"][0]["filters"][1]["expression"],
        "pol"
    );
}

#[tokio::test]
async fn pagination_has_exact_offsets_and_a_disclosed_25000_cap() {
    let pages = [10000, 10000, 5000]
        .map(|count| (200, json!({"rows":vec![json!({"keys":["q"]});count]})))
        .to_vec();
    let (endpoint, server) = fixture(pages).await;
    let result = performance_rows_at(
        &client(),
        "synthetic-token",
        &endpoint,
        "a",
        "b",
        Some("page"),
        &Default::default(),
    )
    .await
    .unwrap();
    assert_eq!(result.rows.len(), 25000);
    assert!(result.may_be_truncated);
    let requests = server.await.unwrap();
    assert_eq!(
        requests
            .iter()
            .map(|r| r["startRow"].as_u64().unwrap())
            .collect::<Vec<_>>(),
        [0, 10000, 20000]
    );
    assert_eq!(
        requests
            .iter()
            .map(|r| r["rowLimit"].as_u64().unwrap())
            .collect::<Vec<_>>(),
        [10000, 10000, 5000]
    );
}

#[tokio::test]
async fn empty_next_page_ends_without_claiming_truncation() {
    let (endpoint, server) = fixture(vec![
        (200, json!({"rows":vec![json!({"keys":["q"]});10000]})),
        (200, json!({})),
    ])
    .await;
    let result = performance_rows_at(
        &client(),
        "synthetic-token",
        &endpoint,
        "a",
        "b",
        Some("query"),
        &Default::default(),
    )
    .await
    .unwrap();
    assert_eq!(result.rows.len(), 10000);
    assert!(!result.may_be_truncated);
    assert_eq!(server.await.unwrap().len(), 2);
}

#[tokio::test]
async fn totals_are_requested_once_without_dimensions() {
    let (endpoint, server) =
        fixture(vec![(200, json!({"rows":[{"clicks":0,"impressions":0}]}))]).await;
    let result = performance_rows_at(
        &client(),
        "synthetic-token",
        &endpoint,
        "a",
        "b",
        None,
        &Default::default(),
    )
    .await
    .unwrap();
    assert_eq!(result.rows[0]["clicks"], 0);
    assert!(!result.may_be_truncated);
    let requests = server.await.unwrap();
    assert_eq!(requests.len(), 1);
    assert!(requests[0].get("dimensions").is_none());
    assert!(requests[0].get("dimensionFilterGroups").is_none());
}

#[tokio::test]
async fn provider_error_on_next_page_does_not_return_partial_success() {
    let (endpoint, server) = fixture(vec![
        (200, json!({"rows":vec![json!({});10000]})),
        (403, json!({"error":{"message":"property access revoked"}})),
    ])
    .await;
    let error = performance_rows_at(
        &client(),
        "synthetic-token",
        &endpoint,
        "a",
        "b",
        Some("query"),
        &Default::default(),
    )
    .await
    .err()
    .unwrap();
    assert!(error.contains("403"));
    assert!(!error.contains("property access revoked"));
    assert_eq!(server.await.unwrap().len(), 2);
}
