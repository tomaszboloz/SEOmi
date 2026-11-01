use super::super::super::session_test_modules::{Server, Store};
use super::tests::{body, client, row, ACCOUNTS, SITE, STREAMS};
use super::*;

#[tokio::test]
async fn discovers_the_property_refreshes_the_token_and_guards_the_command() {
    let reply = body(&[row("20260101", "1", "2")], 1, "USD");
    let store = Store::with_values(&[("gsc_refresh_token_p", "refresh")]);
    let server = Server::new(&[
        ("200 OK", r#"{"access_token":"fixture-access"}"#),
        ACCOUNTS,
        STREAMS,
        ("200 OK", &reply),
    ])
    .await;
    let endpoints = Endpoints {
        token: &server.endpoint,
        accounts: &server.endpoint,
        admin: &server.endpoint,
        data: &server.endpoint,
    };
    let report = daily_with(
        ("p", "fixture.apps.googleusercontent.com"),
        SITE,
        ("2026-01-01", "2026-01-02", None),
        &store,
        &endpoints,
    )
    .await
    .unwrap();
    assert_eq!(
        (report.property.as_str(), report.daily.len()),
        ("properties/9", 1)
    );
    assert_eq!(server.finish().await.len(), 4);
    let none = Server::new(&[("200 OK", r#"{"accountSummaries":[]}"#)]).await;
    let endpoints = Endpoints {
        token: &none.endpoint,
        accounts: &none.endpoint,
        admin: &none.endpoint,
        data: &none.endpoint,
    };
    assert!(collect_daily(
        &client(),
        "tok",
        SITE,
        ("2026-01-01", "2026-01-02", None),
        &endpoints
    )
    .await
    .unwrap_err()
    .contains("No Google Analytics property"));
    assert!(google_analytics_daily(
        "p".into(),
        "c".into(),
        "https://u:p@example.com".into(),
        None,
        None,
        None
    )
    .await
    .is_err());
    assert!(google_analytics_daily(
        "p".into(),
        "c".into(),
        SITE.into(),
        None,
        None,
        Some("nope".into())
    )
    .await
    .is_err());
    assert!(google_analytics_daily(
        "p".into(),
        "c".into(),
        SITE.into(),
        Some("bad".into()),
        None,
        None
    )
    .await
    .is_err());
}
