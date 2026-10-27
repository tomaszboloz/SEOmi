use super::{
    credentials::refresh_token_key,
    performance::search_console_performance_with,
    performance_fixture,
    session_edge_fixture::{Server, Store},
};

const CLIENT_ID: &str = "fixture.apps.googleusercontent.com";
const PROJECT_ID: &str = "fixture-project";

#[tokio::test]
async fn performance_with_store_uses_controlled_token_and_query_endpoints() {
    let key = refresh_token_key(PROJECT_ID).unwrap();
    let store = Store::with_values(&[(&key, "refresh-tok")]);
    let (endpoint, query_server) = performance_fixture::fixture().await;
    let token_server2 = Server::new(&[("200 OK", r#"{"access_token":"synthetic-token"}"#)]).await;
    let result = search_console_performance_with(
        PROJECT_ID.into(),
        CLIENT_ID.into(),
        "https://fixture.test".into(),
        Some("2020-01-01".into()),
        Some("2020-01-02".into()),
        None,
        &store,
        &token_server2.endpoint,
        Some(&endpoint),
    )
    .await
    .unwrap();
    assert_eq!(result["site_url"], "https://fixture.test");
    query_server.await.unwrap();
}
