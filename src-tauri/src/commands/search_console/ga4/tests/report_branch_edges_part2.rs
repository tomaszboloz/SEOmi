use super::*;

#[tokio::test]
async fn offset_reaches_report_row_max() {
    let row = sample_row("/item");
    let responses = [10_000, 10_000, 5_000].map(|count| {
        let rows = vec![row.clone(); count].join(",");
        format!(r#"{{"rowCount":30000,"rows":[{rows}]}}"#)
    });
    let (addr, handle) = serve_responses(responses.into()).await;
    let client = super::super::http_fixture::test_client();
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
    assert_eq!(
        report.rows.len(),
        super::super::super::validation::REPORT_ROW_MAX
    );
    assert_eq!(report.pages, 3);
    handle.await.unwrap();
}
