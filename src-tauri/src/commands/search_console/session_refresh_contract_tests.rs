use super::{
    session_edge_fixture::{form, Server, Store},
    session_fixture::client,
    tokens::refresh_access_token_with_store,
};

const PROJECT: &str = "fixture-project";
const CLIENT: &str = "fixture.apps.googleusercontent.com";
const REFRESH: &str = "gsc_refresh_token_fixture-project";
const SECRET: &str = "gsc_client_secret_fixture-project";

#[tokio::test]
async fn credential_read_errors_stop_refresh_before_secret_lookup_and_network() {
    for (store_error, expected) in [
        (true, "fixture store unavailable"),
        (false, "Search Console token is missing from the OS credential store. Connect your account again."),
    ] {
        let store = Store { read_error: Some((REFRESH, store_error)), ..Store::default() };
        let error = refresh_access_token_with_store(&client(), PROJECT, CLIENT, &store, "invalid-network-endpoint").await.unwrap_err();
        assert_eq!(error, expected);
        assert_eq!(*store.reads.lock().unwrap(), vec![REFRESH]);
        assert!(store.writes.lock().unwrap().is_empty());
    }
}

#[tokio::test]
async fn invalid_project_does_not_touch_credential_store() {
    let store = Store::default();
    let error = refresh_access_token_with_store(
        &client(),
        "../other-project",
        CLIENT,
        &store,
        "invalid-network-endpoint",
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Invalid Google Search Console project identifier.");
    assert!(store.reads.lock().unwrap().is_empty());
    assert!(store.writes.lock().unwrap().is_empty());
}

#[tokio::test]
async fn optional_secret_read_errors_do_not_prevent_refresh_or_rewrite_credentials() {
    for store_error in [true, false] {
        let store = Store {
            read_error: Some((SECRET, store_error)),
            ..Store::with_values(&[
                (REFRESH, "refresh+&token"),
                ("gsc_client_secret_other", "other-secret"),
            ])
        };
        let server = Server::new(&[(
            "200 OK",
            r#"{"access_token":"fresh","refresh_token":"ignored-rotation"}"#,
        )])
        .await;
        let access =
            refresh_access_token_with_store(&client(), PROJECT, CLIENT, &store, &server.endpoint)
                .await
                .unwrap();
        assert_eq!(access, "fresh");
        let fields = form(&server.finish().await[0]);
        assert_eq!(fields["refresh_token"], "refresh+&token");
        assert_eq!(fields["grant_type"], "refresh_token");
        assert!(!fields.contains_key("client_secret"));
        assert_eq!(*store.reads.lock().unwrap(), vec![REFRESH, SECRET]);
        assert!(store.writes.lock().unwrap().is_empty());
        assert_eq!(store.values.lock().unwrap()[REFRESH], "refresh+&token");
    }
}

#[tokio::test]
async fn whitespace_stored_secret_is_omitted_from_refresh_form() {
    let store = Store::with_values(&[(REFRESH, "refresh"), (SECRET, " \t\n ")]);
    let server = Server::new(&[("200 OK", r#"{"access_token":"fresh"}"#)]).await;
    assert_eq!(
        refresh_access_token_with_store(&client(), PROJECT, CLIENT, &store, &server.endpoint)
            .await
            .unwrap(),
        "fresh"
    );
    assert!(!form(&server.finish().await[0]).contains_key("client_secret"));
    assert!(store.writes.lock().unwrap().is_empty());
}

#[tokio::test]
async fn rejected_refresh_keeps_token_and_hides_provider_details() {
    let store = Store::with_values(&[(REFRESH, "refresh"), (SECRET, "secret")]);
    let server = Server::new(&[(
        "400 Bad Request",
        r#"{"error":"invalid_grant","error_description":"refresh secret private-details"}"#,
    )])
    .await;
    let error =
        refresh_access_token_with_store(&client(), PROJECT, CLIENT, &store, &server.endpoint)
            .await
            .unwrap_err();
    assert!(error.contains("400"));
    assert!(!error.contains("private-details"));
    assert!(!error.contains("refresh secret"));
    assert_eq!(store.values.lock().unwrap()[REFRESH], "refresh");
    assert!(store.writes.lock().unwrap().is_empty());
    server.finish().await;
}
