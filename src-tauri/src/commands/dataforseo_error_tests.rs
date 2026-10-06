use super::dataforseo_request_at;
use super::test_fixture::{client, server};
use serde_json::json;

#[tokio::test]
async fn returns_project_credentials_error_before_sending_request() {
    let error = dataforseo_request_at("active-project", "/v3/appendix/user_data", None,
        "http://127.0.0.1:1", &client(), |project| {
            assert_eq!(project, "active-project");
            Err("Connect DataForSEO for this project.".into())
        }).await.unwrap_err();
    assert_eq!(error, "Connect DataForSEO for this project.");
}

#[tokio::test]
async fn hides_transport_details_and_credentials_on_network_failure() {
    let error = dataforseo_request_at("project", "/v3/appendix/user_data", None,
        "invalid-url", &client(), |_| Ok(("secret-login".into(), "secret-pass".into())))
        .await.unwrap_err();
    assert_eq!(error, "DataForSEO request failed.");
}

#[tokio::test]
async fn normalizes_base_and_sends_bodyless_post_when_payload_is_missing() {
    let (base, request) = server("200 OK", r#"{"ok":true}"#).await;
    let value = dataforseo_request_at("project", "/v3/backlinks/summary/live", None,
        &format!("{base}/"), &client(), |_| Ok(("u".into(), "p".into())))
        .await.unwrap();
    let request = request.await.unwrap();
    assert!(request.starts_with("POST /v3/backlinks/summary/live HTTP/1.1"));
    assert_eq!(request.split_once("\r\n\r\n").unwrap().1, "");
    assert_eq!(value, json!({"ok":true}));
}

#[tokio::test]
async fn rejects_non_object_json_and_hides_error_response_body() {
    for body in ["[]", "null", "true", "42", r#""text""#] {
        let (base, _) = server("200 OK", body).await;
        let error = dataforseo_request_at("project", "/v3/appendix/user_data", None,
            &base, &client(), |_| Ok(("u".into(), "p".into())))
            .await.unwrap_err();
        assert_eq!(error, "DataForSEO returned an invalid response.");
    }
    let (base, _) = server("401 Unauthorized", "secret credential diagnostics").await;
    let error = dataforseo_request_at("project", "/v3/appendix/user_data", None,
        &base, &client(), |_| Ok(("u".into(), "p".into())))
        .await.unwrap_err();
    assert_eq!(error, "DataForSEO HTTP 401 Unauthorized: request failed.");
}
