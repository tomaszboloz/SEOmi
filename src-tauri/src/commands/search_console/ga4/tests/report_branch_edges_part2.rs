use super::*;

#[tokio::test]
async fn offset_reaches_report_row_max() {
    let row = sample_row("/item");
    let rows = vec![row; 10_000].join(",");
    let p1 = format!(r#"{{"rowCount":20000,"rows":[{rows}]}}"#);
    let (addr, handle) = serve_responses(vec![p1]).await;
    let client = reqwest::Client::new();
    let report = run_at(
        &client,
        "tok",
        "properties/123",
        "https://example.com",
        "example.com",
        "2026-01-01",
        "2026-01-02",
        &addr,
    )
    .await
    .unwrap();
    assert_eq!(report.status, Ga4Status::Partial);
    assert!(report.may_be_truncated);
    assert_eq!(report.rows.len(), 10_000);
    handle.await.unwrap();
}
