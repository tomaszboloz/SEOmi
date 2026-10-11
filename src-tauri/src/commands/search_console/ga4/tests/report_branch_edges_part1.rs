use super::*;

#[tokio::test]
async fn inconsistent_row_count_across_pages() {
    let p1 = format!(r#"{{"rowCount":10,"rows":[{}]}}"#, sample_row("/1"));
    let p2 = format!(r#"{{"rowCount":20,"rows":[{}]}}"#, sample_row("/2"));
    let (addr, handle) = serve_responses(vec![p1, p2]).await;
    let client = reqwest::Client::new();
    let res = run_at(
        &client,
        "tok",
        "properties/123",
        "https://example.com",
        "example.com",
        "2026-01-01",
        "2026-01-02",
        &addr,
    )
    .await;
    assert_eq!(
        res.unwrap_err(),
        "Google Analytics returned an inconsistent report row count."
    );
    handle.await.unwrap();
}

#[tokio::test]
async fn row_count_none_returned_less_than_limit() {
    let p1 = format!(r#"{{"rows":[{}]}}"#, sample_row("/solo"));
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
    assert_eq!(report.status, Ga4Status::Complete);
    assert_eq!(report.row_count, None);
    assert!(!report.may_be_truncated);
    assert_eq!(report.pages, 1);
    handle.await.unwrap();
}

#[tokio::test]
async fn page_row_count_none_on_subsequent_page() {
    let p1 = format!(r#"{{"rowCount":5,"rows":[{}]}}"#, sample_row("/a"));
    let p2 = format!(r#"{{"rows":[{}]}}"#, sample_row("/b"));
    let (addr, handle) = serve_responses(vec![p1, p2]).await;
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
    assert_eq!(report.pages, 2);
    assert_eq!(report.row_count, Some(5));
    handle.await.unwrap();
}

#[tokio::test]
async fn empty_rows_with_positive_row_count_marks_truncated() {
    let p1 = r#"{"rowCount":5,"rows":[]}"#.to_string();
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
    assert_eq!(report.status, Ga4Status::Missing);
    assert!(report.may_be_truncated);
    assert!(report.rows.is_empty());
    handle.await.unwrap();
}

#[tokio::test]
async fn max_pages_reached_marks_truncated() {
    let pages = (0..super::super::super::validation::MAX_PAGES)
        .map(|i| {
            format!(
                r#"{{"rowCount":100,"rows":[{}]}}"#,
                sample_row(&format!("/{i}"))
            )
        })
        .collect();
    let (addr, handle) = serve_responses(pages).await;
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
    assert_eq!(report.pages, super::super::super::validation::MAX_PAGES);
    assert_eq!(
        report.rows.len(),
        super::super::super::validation::MAX_PAGES
    );
    handle.await.unwrap();
}
