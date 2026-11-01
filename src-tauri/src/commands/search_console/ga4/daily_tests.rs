use super::super::super::session_test_modules::Server;
use super::*;

pub(super) const ACCOUNTS: (&str, &str) = (
    "200 OK",
    r#"{"accountSummaries":[{"propertySummaries":[{"property":"properties/9"}]}]}"#,
);
pub(super) const STREAMS: (&str, &str) = (
    "200 OK",
    r#"{"dataStreams":[{"type":"WEB_DATA_STREAM","webStreamData":{"defaultUri":"https://example.com"}}]}"#,
);
pub(super) const SITE: &str = "https://example.com";

pub(super) fn client() -> Client {
    Client::builder().no_proxy().build().unwrap()
}
pub(super) fn row(date: &str, events: &str, revenue: &str) -> String {
    format!(
        r#"{{"dimensionValues":[{{"value":"{date}"}}],"metricValues":[{{"value":"{events}"}},{{"value":"{revenue}"}}]}}"#
    )
}
pub(super) fn body(rows: &[String], count: usize, currency: &str) -> String {
    format!(
        r#"{{"rowCount":{count},"metadata":{{"currencyCode":"{currency}"}},"rows":[{}]}}"#,
        rows.join(",")
    )
}
pub(super) async fn run(
    reply: &str,
    page: Option<&str>,
) -> (Result<Ga4DailyReport, String>, Vec<String>) {
    let server = Server::new(&[("200 OK", reply)]).await;
    let result = daily_at(
        &client(),
        "tok",
        ("properties/9", SITE, "example.com"),
        ("2026-01-01", "2026-01-31", page.map(str::to_owned)),
        &server.endpoint,
    )
    .await;
    (result, server.finish().await)
}

#[tokio::test]
async fn reads_daily_key_events_and_revenue_with_the_reported_currency() {
    let reply = body(
        &[row("20260101", "3", "12.5"), row("20260102", "0", "0")],
        2,
        "PLN",
    );
    let (result, _) = run(&reply, None).await;
    let report = result.unwrap();
    assert_eq!(
        (report.status.clone(), report.currency_code.as_str()),
        (Ga4Status::Complete, "PLN")
    );
    assert_eq!(
        report.daily[0],
        Ga4DailyRow {
            date: "2026-01-01".into(),
            key_events: 3.0,
            revenue: 12.5
        }
    );
    assert_eq!(report.page_path, None);
}

#[tokio::test]
async fn filters_one_landing_page_and_flags_truncation_or_emptiness() {
    let reply = body(&[row("20260101", "1", "1")], 1, "EUR");
    let (result, _) = run(&reply, Some(" /pricing ")).await;
    assert_eq!(result.unwrap().page_path.as_deref(), Some("/pricing"));
    assert!(request("a", "b", "h", Some("/p"))
        .to_string()
        .contains("BEGINS_WITH"));
    assert!(!request("a", "b", "h", None)
        .to_string()
        .contains("landingPagePlusQueryString"));
    let (result, _) = run(&body(&[row("20260101", "1", "1")], 9, "EUR"), None).await;
    let partial = result.unwrap();
    assert_eq!(
        (partial.status, partial.may_be_truncated),
        (Ga4Status::Partial, true)
    );
    let (result, _) = run(&body(&[], 0, "EUR"), None).await;
    assert_eq!(result.unwrap().status, Ga4Status::Missing);
}
