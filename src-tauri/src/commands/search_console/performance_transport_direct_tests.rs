use super::{
    models::GscPerformanceFilters,
    performance_transport::{dimensions, rows},
    rows_test_fixture::{client, fixture},
};
use serde_json::json;
use tokio::{net::TcpListener, task::JoinHandle};

#[tokio::test]
async fn rows_transport_uses_requested_dimension_and_bearer_token() {
    let (endpoint, server) = fixture(vec![(200, json!({"rows":[{"keys":["query"]}]}))]).await;
    let result = rows(
        &client(),
        "synthetic-token",
        Some(&endpoint),
        "https://fixture.test",
        "2026-01-01",
        "2026-01-02",
        Some("query"),
        &GscPerformanceFilters::default(),
    )
    .await
    .unwrap();
    assert_eq!(result.rows, vec![json!({"keys":["query"]})]);
    assert!(!result.may_be_truncated);
    let requests = server.await.unwrap();
    assert_eq!(requests[0]["dimensions"], json!(["query"]));
}

#[tokio::test]
async fn dimensions_transport_preserves_multiple_dimensions_and_provider_errors() {
    let (endpoint, server) = fixture(vec![(403, json!({"error":{"message":"private"}}))]).await;
    let error = dimensions(
        &client(),
        "synthetic-token",
        Some(&endpoint),
        "https://fixture.test",
        "2026-01-01",
        "2026-01-02",
        &["query", "page"],
        &GscPerformanceFilters::default(),
    )
    .await
    .err()
    .expect("provider failure must be returned");
    assert!(error.contains("403"));
    assert!(!error.contains("private"));
    let requests = server.await.unwrap();
    assert_eq!(requests[0]["dimensions"], json!(["query", "page"]));
}

async fn locally_rejected_google_client() -> (reqwest::Client, JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        if let Ok((socket, _)) = listener.accept().await {
            drop(socket);
        }
    });
    let client = reqwest::Client::builder()
        .no_proxy()
        .resolve("searchconsole.googleapis.com", address)
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .unwrap();
    (client, server)
}

#[tokio::test]
async fn rows_without_fixture_endpoint_builds_google_request_and_surfaces_transport_error() {
    let (client, server) = locally_rejected_google_client().await;
    let error = rows(
        &client,
        "synthetic-token",
        None,
        "https://fixture.test",
        "2026-01-01",
        "2026-01-02",
        Some("query"),
        &GscPerformanceFilters::default(),
    )
    .await
    .err()
    .expect("canonical Search Console transport failure must be returned");
    assert_eq!(error, "Google Search Console request failed.");
    assert!(!error.contains("synthetic-token"));
    tokio::time::timeout(std::time::Duration::from_secs(1), server)
        .await
        .expect("canonical request must reach the local reject fixture")
        .unwrap();
}

#[tokio::test]
async fn dimensions_without_fixture_endpoint_builds_google_request_and_surfaces_transport_error() {
    let (client, server) = locally_rejected_google_client().await;
    let error = dimensions(
        &client,
        "synthetic-token",
        None,
        "https://fixture.test",
        "2026-01-01",
        "2026-01-02",
        &["query", "page"],
        &GscPerformanceFilters::default(),
    )
    .await
    .err()
    .expect("canonical Search Console transport failure must be returned");
    assert_eq!(error, "Google Search Console request failed.");
    assert!(!error.contains("synthetic-token"));
    tokio::time::timeout(std::time::Duration::from_secs(1), server)
        .await
        .expect("canonical request must reach the local reject fixture")
        .unwrap();
}
