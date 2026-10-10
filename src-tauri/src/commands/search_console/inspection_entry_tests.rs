use super::{
    inspection::{inspect_search_console_url, inspection_request},
    tokens::authorized_json_with_access_token,
    transport_fixture::single_response,
};
use serde_json::json;
use url::Url;

const CLIENT_ID: &str = "fixture.apps.googleusercontent.com";

#[tokio::test]
async fn public_inspection_rejects_invalid_urls_before_credentials() {
    for value in ["not-a-url", "ftp://fixture.test/page", "https://"] {
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
    let client = reqwest::Client::builder().no_proxy().build().unwrap();
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
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&body).unwrap(),
        json!({
            "inspectionUrl": "https://fixture.test/page?a=1",
            "siteUrl": "sc-domain:fixture.test",
            "languageCode": "pl-PL"
        })
    );
}
