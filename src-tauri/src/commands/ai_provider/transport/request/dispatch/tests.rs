use super::{probe, send_to};
use crate::commands::dataforseo::contract_tests::fixture::server;
use reqwest::StatusCode;

const OPTS: (&str, Option<&str>, bool) = ("m1", Some("hi"), false);

#[tokio::test]
async fn send_returns_the_provider_json_for_each_provider() {
    for provider in ["openai", "claude", "gemini"] {
        let (origin, received) = server("200 OK", r#"{"ok":true}"#).await;
        let (status, body) = send_to(Some(&origin), provider, "key", OPTS).await.unwrap();
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["ok"], true);
        assert!(received.await.unwrap().starts_with("POST "));
    }
}

#[tokio::test]
async fn send_without_prompt_lists_models_with_a_get() {
    let (origin, received) = server("200 OK", "{}").await;
    send_to(Some(&origin), "openai", "key", ("", None, false))
        .await
        .unwrap();
    assert!(received.await.unwrap().starts_with("GET /v1/models"));
}

#[tokio::test]
async fn send_validates_prompt_and_model_before_the_network() {
    let bad_prompt = send_to(
        Some("http://127.0.0.1:1"),
        "openai",
        "k",
        ("m", Some(""), false),
    );
    assert_eq!(bad_prompt.await.unwrap_err(), "Invalid AI prompt.");
    let bad_model = send_to(
        Some("http://127.0.0.1:1"),
        "openai",
        "k",
        (" ", Some("p"), false),
    );
    assert_eq!(bad_model.await.unwrap_err(), "Invalid AI model.");
}

#[tokio::test]
async fn send_maps_transport_status_and_body_failures() {
    let down = send_to(Some("http://127.0.0.1:1"), "openai", "k", OPTS).await;
    assert_eq!(down.unwrap_err(), "AI provider request failed.");
    let (origin, _) = server("401 Unauthorized", "secret").await;
    let denied = send_to(Some(&origin), "claude", "k", OPTS).await;
    assert_eq!(
        denied.unwrap_err(),
        "AI provider request failed with HTTP 401."
    );
    let (origin, _) = server("200 OK", "not json").await;
    let invalid = send_to(Some(&origin), "gemini", "k", OPTS).await;
    assert_eq!(
        invalid.unwrap_err(),
        "AI provider returned an invalid response."
    );
    let unsupported = send_to(None, "nope", "k", OPTS).await;
    assert_eq!(unsupported.unwrap_err(), "Unsupported AI provider request.");
}

#[tokio::test]
async fn probe_reports_status_and_body_validity() {
    let (origin, received) = server("200 OK", "{}").await;
    let ok = probe(Some(&origin), "claude", "k").await.unwrap();
    assert!(ok.success && ok.status == Some(200));
    assert!(received.await.unwrap().starts_with("POST /v1/messages"));
    let (origin, _) = server("200 OK", "[]").await;
    let invalid = probe(Some(&origin), "openai", "k").await.unwrap();
    assert!(!invalid.success && invalid.status == Some(200));
    let (origin, _) = server("403 Forbidden", "{}").await;
    let denied = probe(Some(&origin), "gemini", "k").await.unwrap();
    assert!(!denied.success && denied.status == Some(403));
    let down = probe(Some("http://127.0.0.1:1"), "openai", "k").await;
    assert_eq!(down.unwrap_err(), "AI provider request failed.");
    assert!(probe(None, "nope", "k").await.is_err());
}
