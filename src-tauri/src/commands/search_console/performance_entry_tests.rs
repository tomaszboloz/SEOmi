use super::{
    models::GscPerformanceFilters,
    performance::{search_console_performance, search_console_performance_at},
    performance_fixture,
    rows_test_fixture::client,
};
use serde_json::json;

const CLIENT_ID: &str = "fixture.apps.googleusercontent.com";

#[tokio::test]
async fn public_performance_command_rejects_empty_property_before_credentials() {
    let error = search_console_performance(
        "fixture-project".into(),
        CLIENT_ID.into(),
        "   ".into(),
        None,
        None,
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Wybierz property Search Console.");
}

#[tokio::test]
async fn public_performance_command_rejects_bad_range_and_filters_before_credentials() {
    let bad_date = search_console_performance(
        "fixture-project".into(),
        CLIENT_ID.into(),
        "https://fixture.test".into(),
        Some("2026-02-30".into()),
        Some("2026-03-01".into()),
        None,
    )
    .await
    .unwrap_err();
    assert_eq!(bad_date, "Start date must be a valid YYYY-MM-DD date.");
    let bad_filter = search_console_performance(
        "fixture-project".into(),
        CLIENT_ID.into(),
        "https://fixture.test".into(),
        Some("2020-01-01".into()),
        Some("2020-01-02".into()),
        Some(GscPerformanceFilters {
            search_type: Some("unsupported".into()),
            ..Default::default()
        }),
    )
    .await
    .unwrap_err();
    assert_eq!(bad_filter, "Invalid Search Console search type.");
}

#[tokio::test]
async fn public_performance_command_validates_and_attempts_token_refresh() {
    let err = search_console_performance(
        "fixture-project".into(),
        CLIENT_ID.into(),
        "https://fixture.test".into(),
        Some("2026-01-01".into()),
        Some("2026-01-02".into()),
        None,
    )
    .await
    .unwrap_err();
    assert!(err.contains("Search Console refresh token") || err.contains("credential store"));
}

#[tokio::test]
async fn endpoint_helper_maps_queries_pages_totals_daily_and_pairs() {
    let (endpoint, server) = performance_fixture::fixture().await;
    let output = search_console_performance_at(
        &client(),
        "synthetic-token",
        &endpoint,
        "https://fixture.test",
        "2020-01-01",
        "2020-01-02",
        &Default::default(),
    )
    .await
    .unwrap();
    assert_eq!(output["site_url"], "https://fixture.test");
    assert_eq!(output["queries"][0]["query"], "query-key");
    assert_eq!(output["queries"][0]["clicks"], 2.0);
    assert_eq!(output["pages"][0]["page"], "https://fixture.test/page");
    assert_eq!(output["pages"][0]["clicks"], 3.0);
    assert_eq!(output["daily"][0]["date"], "2020-01-02");
    assert_eq!(output["daily"][0]["clicks"], 4.0);
    assert_eq!(output["query_pages"][0]["query"], "pair-query");
    assert_eq!(
        output["query_pages"][0]["page"],
        "https://fixture.test/pair"
    );
    assert_eq!(output["total_clicks"], 7.0);
    let requests = server.await.unwrap();
    assert_eq!(requests.len(), 5);
    assert!(requests
        .iter()
        .any(|request| request["dimensions"] == json!(["query"])));
    assert!(requests
        .iter()
        .any(|request| request["dimensions"] == json!(["page"])));
    assert!(requests
        .iter()
        .any(|request| request["dimensions"] == json!(["date"])));
    assert!(requests
        .iter()
        .any(|request| request["dimensions"] == json!(["query", "page"])));
    assert!(requests
        .iter()
        .any(|request| request.get("dimensions").is_none()));
}
