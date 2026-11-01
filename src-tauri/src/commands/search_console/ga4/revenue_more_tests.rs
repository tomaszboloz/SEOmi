use super::super::super::session_test_modules::{Server, Store};
use super::tests::{report, row, test_client, ACCOUNTS, RANGE, SITE, STREAMS};
use super::*;

#[tokio::test]
async fn validates_inputs_before_calling_google() {
    let client = test_client();
    let call = |token: &'static str,
                property: &'static str,
                host: &'static str,
                range: (&'static str, &'static str)| {
        let client = client.clone();
        async move {
            revenue_at(
                &client,
                token,
                property,
                SITE,
                host,
                range,
                "http://127.0.0.1:1",
            )
            .await
            .unwrap_err()
        }
    };
    assert!(call("", "properties/9", "example.com", RANGE)
        .await
        .contains("token"));
    assert!(call("t", "bad", "example.com", RANGE)
        .await
        .contains("property"));
    assert!(call(
        "t",
        "properties/9",
        "example.com",
        ("2026-02-01", "2026-01-01")
    )
    .await
    .contains("date range"));
    assert!(call("t", "properties/9", "other.com", RANGE)
        .await
        .contains("outside"));
    assert!(call("t", "properties/9", "bad/host", RANGE)
        .await
        .contains("outside"));
}

#[tokio::test]
async fn discovers_the_property_then_reports_and_refuses_unmatched_sites() {
    let body = report(&row("/a", "3"), 1, "USD");
    let server = Server::new(&[ACCOUNTS, STREAMS, ("200 OK", &body)]).await;
    let endpoints = Endpoints {
        token: &server.endpoint,
        accounts: &server.endpoint,
        admin: &server.endpoint,
        data: &server.endpoint,
    };
    let client = test_client();
    let report = collect_revenue(&client, "tok", SITE, RANGE, &endpoints)
        .await
        .unwrap();
    assert_eq!(
        (report.property.as_str(), report.currency_code.as_str()),
        ("properties/9", "USD")
    );
    server.finish().await;
    let none = Server::new(&[("200 OK", r#"{"accountSummaries":[]}"#)]).await;
    let endpoints = Endpoints {
        token: &none.endpoint,
        accounts: &none.endpoint,
        admin: &none.endpoint,
        data: &none.endpoint,
    };
    assert!(collect_revenue(&client, "tok", SITE, RANGE, &endpoints)
        .await
        .unwrap_err()
        .contains("No Google Analytics property"));
}

#[tokio::test]
async fn refreshes_the_stored_token_before_reading_revenue() {
    let store = Store::with_values(&[("gsc_refresh_token_p", "refresh")]);
    let body = report(&row("/a", "3"), 1, "USD");
    let server = Server::new(&[
        ("200 OK", r#"{"access_token":"fixture-access"}"#),
        ACCOUNTS,
        STREAMS,
        ("200 OK", &body),
    ])
    .await;
    let endpoints = Endpoints {
        token: &server.endpoint,
        accounts: &server.endpoint,
        admin: &server.endpoint,
        data: &server.endpoint,
    };
    let report = revenue_with(
        ("p", "fixture.apps.googleusercontent.com"),
        SITE,
        RANGE,
        &store,
        &endpoints,
    )
    .await
    .unwrap();
    assert_eq!(report.rows.len(), 1);
    assert_eq!(server.finish().await.len(), 4);
}

#[tokio::test]
async fn ipc_command_rejects_invalid_site_and_dates_before_any_network_work() {
    assert!(google_analytics_revenue(
        "p".into(),
        "c".into(),
        "https://u:p@example.com".into(),
        None,
        None
    )
    .await
    .is_err());
    assert!(google_analytics_revenue(
        "p".into(),
        "c".into(),
        SITE.into(),
        Some("bad".into()),
        None
    )
    .await
    .is_err());
}
