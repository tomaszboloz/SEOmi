use super::super::super::session_test_modules::{Server, Store};
use super::*;

pub(super) const ACCOUNTS: (&str, &str) = (
    "200 OK",
    r#"{"accountSummaries":[{"propertySummaries":[{"property":"properties/9"}]}]}"#,
);
pub(super) const STREAMS: (&str, &str) = (
    "200 OK",
    r#"{"dataStreams":[{"type":"WEB_DATA_STREAM","webStreamData":{"defaultUri":"https://example.com"}}]}"#,
);
pub(super) fn test_client() -> reqwest::Client {
    reqwest::Client::builder().no_proxy().build().unwrap()
}
pub(super) const SITE: &str = "https://example.com";
pub(super) const RANGE: (&str, &str) = ("2026-01-01", "2026-01-31");

pub(super) fn report(rows: &str, count: usize, currency: &str) -> String {
    format!(r#"{{"rowCount":{count},"metadata":{{"currencyCode":"{currency}"}},"rows":[{rows}]}}"#)
}
pub(super) fn row(page: &str, value: &str) -> String {
    format!(
        r#"{{"dimensionValues":[{{"value":"{page}"}},{{"value":"example.com"}}],"metricValues":[{{"value":"{value}"}}]}}"#
    )
}
async fn run(replies: &[(&str, &str)]) -> (Result<Ga4RevenueReport, String>, Vec<String>) {
    let server = Server::new(replies).await;
    let result = revenue_at(
        &test_client(),
        "tok",
        "properties/9",
        SITE,
        "example.com",
        RANGE,
        &server.endpoint,
    )
    .await;
    (result, server.finish().await)
}

#[tokio::test]
async fn reads_organic_revenue_with_the_reported_currency() {
    let body = report(
        &format!("{},{}", row("/a", "12.5"), row("/b?x=1", "0")),
        2,
        "PLN",
    );
    let (result, requests) = run(&[("200 OK", &body)]).await;
    let report = result.unwrap();
    assert_eq!(
        (report.status.clone(), report.currency_code.as_str()),
        (Ga4Status::Complete, "PLN")
    );
    assert_eq!(
        report.rows[0],
        Ga4RevenueRow {
            landing_page: "/a".into(),
            revenue: 12.5
        }
    );
    assert_eq!(report.attribution, "ga4-session-landing-page");
    assert!(requests[0].contains("totalRevenue") && requests[0].contains("Organic Search"));
}

#[tokio::test]
async fn pages_until_the_row_count_and_flags_incomplete_data() {
    let first = report(&row("/a", "1"), 2, "EUR");
    let second = report(&row("/b", "2"), 2, "EUR");
    let (result, _) = run(&[("200 OK", &first), ("200 OK", &second)]).await;
    assert_eq!(result.unwrap().rows.len(), 2);
    let short = report(&row("/a", "1"), 5, "EUR");
    let empty = report("", 5, "EUR");
    let (result, _) = run(&[("200 OK", &short), ("200 OK", &empty)]).await;
    let partial = result.unwrap();
    assert_eq!(
        (partial.status, partial.may_be_truncated),
        (Ga4Status::Partial, true)
    );
    let endless = report(&row("/a", "1"), 1000, "EUR");
    let replies = vec![("200 OK", endless.as_str()); MAX_PAGES];
    let (result, _) = run(&replies).await;
    assert_eq!(result.unwrap().rows.len(), MAX_PAGES);
    let (result, _) = run(&[("200 OK", &report("", 0, "EUR"))]).await;
    assert_eq!(result.unwrap().status, Ga4Status::Missing);
}

#[tokio::test]
async fn rejects_missing_currency_and_malformed_rows() {
    let no_currency = format!(r#"{{"rowCount":1,"rows":[{}]}}"#, row("/a", "1"));
    for (body, text) in [
        (no_currency, "currency"),
        (report(&row("/a", "1"), 1, "pln"), "currency"),
        (report(&row("/a", "-3"), 1, "EUR"), "amount"),
        (report(&row("/a", "abc"), 1, "EUR"), "amount"),
        (
            report(r#"{"dimensionValues":[],"metricValues":[]}"#, 1, "EUR"),
            "row",
        ),
        (
            report(
                r#"{"dimensionValues":[{"value":null}],"metricValues":[{"value":"1"}]}"#,
                1,
                "EUR",
            ),
            "row",
        ),
        (r#"{"rows":"x"}"#.to_string(), "report"),
    ] {
        let (result, _) = run(&[("200 OK", &body)]).await;
        assert!(result.unwrap_err().contains(text), "{text}");
    }
}
