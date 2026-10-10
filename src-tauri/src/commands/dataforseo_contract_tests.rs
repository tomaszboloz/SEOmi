use super::dataforseo_request_at;
use serde_json::{json, Value};
#[path = "dataforseo_fixture.rs"]
mod fixture;
use fixture::{client, server};

#[tokio::test]
async fn rejects_unknown_endpoint_before_reading_credentials() {
    let error = dataforseo_request_at(
        "project",
        "/v3/not-allowed",
        None,
        "http://127.0.0.1:1",
        &client(),
        |_| panic!("credentials must not be read"),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Unsupported DataForSEO endpoint.");
}

#[tokio::test]
async fn sends_get_with_basic_auth_without_payload() {
    let (base, request) = server("200 OK", r#"{"ok":true}"#).await;
    let value = dataforseo_request_at(
        "project",
        "/v3/appendix/user_data",
        Some(json!({"ignored": true})),
        &base,
        &client(),
        |_| Ok(("login".into(), "pass".into())),
    )
    .await
    .unwrap();
    let request = request.await.unwrap();
    assert!(request.starts_with("GET /v3/appendix/user_data HTTP/1.1"));
    assert!(request.contains("authorization: Basic bG9naW46cGFzcw=="));
    assert!(!request.contains("ignored"));
    assert_eq!(value, json!({"ok": true}));
}

#[tokio::test]
async fn sends_post_payload_and_reports_provider_errors() {
    let (base, request) = server("200 OK", r#"{"task":1}"#).await;
    let value = dataforseo_request_at(
        "project",
        "/v3/serp/google/organic/live/regular",
        Some(json!({"keyword":"seo"})),
        &base,
        &client(),
        |_| Ok(("u".into(), "p".into())),
    )
    .await
    .unwrap();
    let request = request.await.unwrap();
    assert!(request.starts_with("POST /v3/serp/google/organic/live/regular HTTP/1.1"));
    let body = request.split("\r\n\r\n").nth(1).unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(body).unwrap(),
        json!({"keyword":"seo"})
    );
    assert_eq!(value, json!({"task": 1}));

    let (base, _) = server("503 Service Unavailable", "temporarily down").await;
    let error = dataforseo_request_at(
        "project",
        "/v3/serp/google/organic/live/regular",
        None,
        &base,
        &client(),
        |_| Ok(("u".into(), "p".into())),
    )
    .await
    .unwrap_err();
    assert!(error.contains("DataForSEO HTTP 503"));
}

#[tokio::test]
async fn rejects_malformed_provider_json() {
    let (base, _) = server("200 OK", "not-json").await;
    let error = dataforseo_request_at(
        "project",
        "/v3/appendix/user_data",
        None,
        &base,
        &client(),
        |_| Ok(("u".into(), "p".into())),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "DataForSEO returned an invalid response.");
}
#[tokio::test]
async fn public_command_rejects_unknown_endpoint() {
    let error = super::dataforseo_request("project".into(), "/v3/not-allowed".into(), None)
        .await
        .unwrap_err();
    assert_eq!(error, "Unsupported DataForSEO endpoint.");
}

#[tokio::test]
async fn public_command_reads_credentials_for_allowed_endpoint() {
    let error = super::dataforseo_request("project".into(), "/v3/appendix/user_data".into(), None)
        .await
        .unwrap_err();
    assert!(error.contains("DataForSEO login") || error.contains("credential store"));
}

#[tokio::test]
async fn reports_request_failure_on_network_error() {
    let error = dataforseo_request_at(
        "project",
        "/v3/appendix/user_data",
        None,
        "http://127.0.0.1:1",
        &client(),
        |_| Ok(("u".into(), "p".into())),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "DataForSEO request failed.");
}

#[tokio::test]
async fn dataforseo_ipc_command_handles_payload() {
    use crate::utils::test_app::{invoke, StorageApp};
    use tauri::test::mock_builder;
    let app = StorageApp::new(
        mock_builder().invoke_handler(tauri::generate_handler![super::dataforseo_request]),
    );
    let view = tauri::WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap();
    let err = invoke(
        &view,
        "dataforseo_request",
        json!({"projectId":"p","path":"/v3/bad","payload":null}),
    )
    .unwrap_err();
    assert!(err.as_str().unwrap().contains("Unsupported DataForSEO"));
}
