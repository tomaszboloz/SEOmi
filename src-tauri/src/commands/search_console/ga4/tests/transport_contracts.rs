use super::super::{collect_at, models::Ga4Status};
use super::http_fixture::server;

#[tokio::test]
async fn discovers_matching_stream_and_paginates_landing_page_report() {
    let (base, server) = server().await;
    let client = reqwest::Client::builder().build().unwrap();
    let snapshot = collect_at(
        &client,
        "synthetic-token",
        "https://example.com",
        "2026-09-01",
        "2026-09-30",
        &format!("{base}/accountSummaries"),
        &base,
        &base,
    )
    .await
    .unwrap();
    assert_eq!(snapshot.status, Ga4Status::Complete);
    assert_eq!(
        snapshot.discovery.property.as_ref().unwrap().name,
        "properties/9"
    );
    let serialized = serde_json::to_string(&snapshot).unwrap();
    let report = snapshot.report.unwrap();
    assert_eq!(report.rows.len(), 3);
    assert_eq!(report.rows[1].landing_page, "/pricing?q=x");
    assert_eq!(report.rows[2].sessions, 1.0);
    assert_eq!(report.start_date, "2026-09-01");
    assert!(!serialized.contains("synthetic-token"));
    let requests = server.await.unwrap();
    assert_eq!(requests.len(), 4);
    assert!(requests.iter().all(|request| request
        .headers
        .contains("authorization: bearer synthetic-token")));
    let report_request = requests
        .iter()
        .find(|request| request.path.contains(":runreport"))
        .unwrap();
    let body = String::from_utf8_lossy(&report_request.body);
    assert!(body.contains("landingPagePlusQueryString"));
    assert!(body.contains("engagedSessions"));
    assert!(body.contains("keyEvents"));
    assert!(body.contains("\"hostName\""));
    assert!(body.contains("example.com"));
}

#[tokio::test]
async fn missing_account_evidence_is_reported_without_fabricated_report_metrics() {
    let (base, server) = super::http_fixture::server_empty().await;
    let result = collect_at(
        &super::http_fixture::test_client(),
        "token",
        "https://example.com",
        "2026-09-01",
        "2026-09-30",
        &format!("{base}/accountSummaries"),
        &base,
        &base,
    )
    .await
    .unwrap();
    assert_eq!(result.status, Ga4Status::Missing);
    assert!(result.report.is_none());
    assert!(result.discovery.property.is_none());
    server.await.unwrap();
}
