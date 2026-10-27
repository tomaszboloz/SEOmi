use super::{
    disconnect::{deletion_outcome, read_outcome},
    inspection::{inspection_client, is_inspectable},
    performance::search_console_performance_at,
    rows_test_fixture::{client as fixture_client, fixture},
    session::{read_result, write_result, CredentialReadError},
    tokens::authorized_json_after_refresh,
    transport_fixture::single_response,
};
use serde_json::json;

fn failure() -> keyring::Error {
    keyring::Error::Invalid("attribute".into(), "synthetic".into())
}

#[test]
fn disconnect_maps_keychain_outcomes() {
    assert_eq!(deletion_outcome(Ok(())), Ok(()));
    assert_eq!(deletion_outcome(Err(keyring::Error::NoEntry)), Ok(()));
    assert_eq!(deletion_outcome(Err(failure())), Err(failure().to_string()));
    assert_eq!(read_outcome(Ok("token".into())), Ok(Some("token".into())));
    assert_eq!(read_outcome(Err(keyring::Error::NoEntry)), Ok(None));
    assert_eq!(read_outcome(Err(failure())), Err(failure().to_string()));
}

#[test]
fn session_store_maps_keychain_outcomes() {
    assert!(matches!(read_result(Ok("v".into())), Ok(Some(value)) if value == "v"));
    assert!(matches!(
        read_result(Err(keyring::Error::NoEntry)),
        Ok(None)
    ));
    assert!(matches!(
        read_result(Err(failure())),
        Err(CredentialReadError::Value)
    ));
    assert_eq!(write_result(Ok(())), Ok(()));
    assert_eq!(write_result(Err(failure())), Err(failure().to_string()));
}

#[test]
fn inspection_requires_http_scheme_with_a_host_and_a_built_client() {
    assert!(is_inspectable("https", Some("example.com")));
    assert!(!is_inspectable("http", None));
    assert!(!is_inspectable("ftp", Some("example.com")));
    let build_error = reqwest::Client::new().get("not a url").build().unwrap_err();
    let expected = build_error.to_string();
    assert_eq!(inspection_client(Err(build_error)).unwrap_err(), expected);
    assert!(inspection_client(Ok(reqwest::Client::new())).is_ok());
}

#[tokio::test]
async fn authorized_json_stops_on_a_failed_refresh_and_uses_a_fresh_token() {
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let unused = client.get("http://127.0.0.1:1/never");
    assert_eq!(
        authorized_json_after_refresh(Err("refresh failed".into()), unused)
            .await
            .unwrap_err(),
        "refresh failed"
    );
    let (endpoint, server) = single_response("200 OK", r#"{"ok":true}"#).await;
    let value = authorized_json_after_refresh(Ok("fresh".into()), client.get(endpoint))
        .await
        .unwrap();
    assert_eq!(value["ok"], true);
    let (headers, _) = server.await.unwrap();
    assert!(headers.contains("authorization: bearer fresh"));
}

#[tokio::test]
async fn a_failing_report_request_aborts_the_whole_performance_fetch() {
    let (endpoint, server) = fixture(vec![(500, json!({"error": {"message": "boom"}}))]).await;
    let error = search_console_performance_at(
        &fixture_client(),
        "synthetic-token",
        &endpoint,
        "https://fixture.test",
        "2020-01-01",
        "2020-01-02",
        &Default::default(),
    )
    .await
    .unwrap_err();
    assert!(!error.is_empty());
    server.abort();
}
