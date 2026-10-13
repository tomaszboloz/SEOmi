use super::super::super::session_test_modules::{dependencies, Server, Store};
use super::{analytics_client, connect_with, list_with, performance_with, Endpoints};
use crate::commands::search_console::ga4::models::Ga4Status;

const PROJECT: &str = "fixture-project";
const CLIENT: &str = "fixture.apps.googleusercontent.com";
const TOKEN_KEY: &str = "gsc_refresh_token_fixture-project";
const TOKEN_REPLY: (&str, &str) = ("200 OK", r#"{"access_token":"fixture-access"}"#);
const NO_ACCOUNTS: (&str, &str) = ("200 OK", r#"{"accountSummaries":[]}"#);

fn endpoints(base: &str) -> Endpoints<'_> {
    Endpoints {
        token: base,
        accounts: base,
        admin: base,
        data: base,
    }
}

#[tokio::test]
async fn connect_with_requests_the_ga4_scope_pair_and_persists_the_refresh_token() {
    let store = Store::default();
    let server = Server::new(&[
        (
            "200 OK",
            r#"{"access_token":"fixture-access","refresh_token":"fixture-refresh"}"#,
        ),
        ("200 OK", r#"{"siteEntry":[]}"#),
    ])
    .await;
    let sites = connect_with(PROJECT.into(), CLIENT.into(), None, &store, |_| {
        dependencies(&store, &server.endpoint, &server.endpoint)
    })
    .await
    .unwrap();
    assert!(sites.is_empty());
    assert_eq!(store.writes.lock().unwrap()[0].0, TOKEN_KEY);
    assert_eq!(server.finish().await.len(), 2);
}

#[tokio::test]
async fn list_with_refreshes_the_token_then_discovers_properties() {
    let store = Store::with_values(&[(TOKEN_KEY, "fixture-refresh")]);
    let server = Server::new(&[TOKEN_REPLY, NO_ACCOUNTS]).await;
    let discovery = list_with(
        (PROJECT, CLIENT),
        "https://example.com",
        &store,
        &endpoints(&server.endpoint),
    )
    .await
    .unwrap();
    assert!(discovery.property.is_none());
    assert_eq!(discovery.status, Ga4Status::Missing);
    let requests = server.finish().await;
    assert!(requests[0].contains("grant_type=refresh_token"));
    assert!(requests[1]
        .to_ascii_lowercase()
        .contains("authorization: bearer fixture-access"));
}

#[tokio::test]
async fn performance_with_collects_a_snapshot_for_the_requested_range() {
    let store = Store::with_values(&[(TOKEN_KEY, "fixture-refresh")]);
    let server = Server::new(&[TOKEN_REPLY, NO_ACCOUNTS]).await;
    let snapshot = performance_with(
        (PROJECT, CLIENT),
        "https://example.com",
        ("2026-01-01", "2026-01-02"),
        &store,
        &endpoints(&server.endpoint),
    )
    .await
    .unwrap();
    assert_eq!(snapshot.start_date, "2026-01-01");
    assert_eq!(snapshot.end_date, "2026-01-02");
    assert!(snapshot.report.is_none());
    assert_eq!(server.finish().await.len(), 2);
}

#[test]
fn a_failed_client_build_is_reported_without_provider_detail() {
    let failed = reqwest::Client::new().get("not a url").build().unwrap_err();
    assert_eq!(
        analytics_client(Err(failed)).unwrap_err(),
        "Unable to initialize the Google Analytics client."
    );
}
