use super::{
    connect::connect_search_console_with,
    session_edge_fixture::{dependencies, Server, Store},
};

const PROJECT: &str = "fixture-project";
const CLIENT: &str = "fixture.apps.googleusercontent.com";
const REFRESH: &str = "gsc_refresh_token_fixture-project";
const SECRET: &str = "gsc_client_secret_fixture-project";

#[tokio::test]
async fn secret_write_failure_reports_its_stage_after_refresh_was_saved() {
    let store = Store {
        write_error: Some(SECRET),
        ..Store::with_values(&[(SECRET, "old-secret")])
    };
    let server = Server::new(&[
        (
            "200 OK",
            r#"{"access_token":"access","refresh_token":"refresh"}"#,
        ),
        ("200 OK", r#"{"siteEntry":[]}"#),
    ])
    .await;
    let error = connect_search_console_with(
        PROJECT.into(),
        CLIENT.into(),
        Some("new-secret".into()),
        dependencies(&store, &server.endpoint, &server.endpoint),
    )
    .await
    .err()
    .unwrap();
    assert_eq!(
        error,
        "Unable to save the Search Console client secret: fixture write rejected"
    );
    assert_eq!(store.values.lock().unwrap()[REFRESH], "refresh");
    assert_eq!(store.values.lock().unwrap()[SECRET], "old-secret");
    assert_eq!(store.writes.lock().unwrap().len(), 2);
    server.finish().await;
}
