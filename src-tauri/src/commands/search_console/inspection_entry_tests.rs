use super::{
    inspect_search_console_url,
    inspection::inspection_request,
    rows_test_fixture::client,
    tokens::authorized_json_with_access_token,
    transport_fixture::{closed_response, single_response},
};
use serde_json::json;
use url::Url;

const CLIENT_ID: &str = "fixture.apps.googleusercontent.com";

#[tokio::test]
async fn public_inspection_rejects_invalid_urls_before_credentials() {
    for value in [
        "not-a-url",
        "ftp://fixture.test/page",
        "https://",
        "http://",
        "mailto:fixture@fixture.test",
        "data:text/plain,fixture",
    ] {
        let error = inspect_search_console_url(
            "fixture-project".into(),
            CLIENT_ID.into(),
            "https://fixture.test".into(),
            value.into(),
        )
        .await
        .unwrap_err();
        assert_eq!(error, "Enter a complete HTTP or HTTPS URL for inspection.");
    }
    let error = inspect_search_console_url(
        "bad project".into(),
        CLIENT_ID.into(),
        "https://fixture.test".into(),
        "https://fixture.test/page".into(),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Invalid Google Search Console project identifier.");
}

#[tokio::test]
async fn inspection_request_sends_bearer_and_exact_google_payload() {
    let (endpoint, server) = single_response("200 OK", r#"{"inspectionResult":"fixture"}"#).await;
    let client = client();
    let url = Url::parse("https://fixture.test/page?a=1").unwrap();
    let value = authorized_json_with_access_token(
        "synthetic-token",
        inspection_request(&client, &endpoint, "sc-domain:fixture.test", &url),
    )
    .await
    .unwrap();
    assert_eq!(value, json!({"inspectionResult": "fixture"}));
    let (headers, body) = server.await.unwrap();
    assert!(headers.starts_with("post / http/1.1"));
    assert!(headers.contains("authorization: bearer synthetic-token\r\n"));
    assert!(headers.contains("content-type: application/json\r\n"));
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&body).unwrap(),
        json!({
            "inspectionUrl": "https://fixture.test/page?a=1",
            "siteUrl": "sc-domain:fixture.test",
            "languageCode": "pl-PL"
        })
    );
}

#[tokio::test]
async fn inspection_transport_rejects_status_invalid_json_and_non_object_responses() {
    let client = client();
    let url = Url::parse("http://fixture.test/page").unwrap();
    for (status, body, expected) in [
        (
            "429 Too Many Requests",
            r#"{"error":"synthetic-token"}"#,
            "Google Search Console HTTP 429 Too Many Requests: request failed.",
        ),
        (
            "200 OK",
            "not-json",
            "Google Search Console returned an invalid response.",
        ),
        (
            "200 OK",
            "[]",
            "Google Search Console returned an invalid response.",
        ),
    ] {
        let (endpoint, server) = single_response(status, body).await;
        let error = authorized_json_with_access_token(
            "synthetic-token",
            inspection_request(&client, &endpoint, "http://fixture.test/", &url),
        )
        .await
        .unwrap_err();
        assert_eq!(error, expected);
        assert!(!error.contains("synthetic-token"));
        server.await.unwrap();
    }
}

#[tokio::test]
async fn inspection_transport_reports_closed_connection_without_exposing_credentials() {
    let (endpoint, server) = closed_response().await;
    let client = client();
    let url = Url::parse("https://fixture.test/page").unwrap();
    let error = authorized_json_with_access_token(
        "synthetic-token",
        inspection_request(&client, &endpoint, "sc-domain:fixture.test", &url),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Google Search Console request failed.");
    server.await.unwrap();
}
