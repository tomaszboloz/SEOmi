use super::{connection_succeeded, request, send, test_connection};
use reqwest::{Method, StatusCode};
use serde_json::Value;

fn build(provider: &str, prompt: Option<&str>, suggestions: bool) -> reqwest::Request {
    request(provider, "k e", "m1", prompt, suggestions)
        .unwrap()
        .build()
        .unwrap()
}

fn body(req: &reqwest::Request) -> Value {
    serde_json::from_slice(req.body().unwrap().as_bytes().unwrap()).unwrap()
}

#[test]
fn openai_requests_use_bearer_auth_and_toggle_json_mode() {
    let models = build("openai", None, false);
    assert_eq!(models.method(), Method::GET);
    assert_eq!(models.url().as_str(), "https://api.openai.com/v1/models");
    assert_eq!(models.headers()["authorization"], "Bearer k e");
    assert!(models.body().is_none());
    let chat = build("openai", Some("hi"), true);
    assert_eq!(chat.method(), Method::POST);
    assert_eq!(chat.headers()["content-type"], "application/json");
    assert_eq!(body(&chat)["response_format"]["type"], "json_object");
    let plain = build("openai", Some("hi"), false);
    assert!(body(&plain).get("response_format").is_none());
    assert_eq!(body(&plain)["messages"][0]["content"], "hi");
    // Reasoning models answer 400 to any temperature other than the default.
    assert!(body(&chat).get("temperature").is_none());
    assert!(body(&plain).get("temperature").is_none());
}

#[test]
fn claude_requests_use_api_key_headers() {
    let models = build("claude", None, false);
    // The default page holds 20 models; one request asks for the whole list.
    let listing = "https://api.anthropic.com/v1/models?limit=1000";
    assert_eq!(models.url().as_str(), listing);
    assert_eq!(models.headers()["x-api-key"], "k e");
    let chat = build("claude", Some("hi"), false);
    assert_eq!(chat.headers()["anthropic-version"], "2023-06-01");
    assert_eq!(body(&chat)["model"], "m1");
    assert_eq!(body(&chat)["max_tokens"], 16_000);
}

#[test]
fn gemini_requests_carry_the_key_in_the_query() {
    let models = build("gemini", None, false);
    assert!(models
        .url()
        .as_str()
        .ends_with("/models?pageSize=1000&key=k+e"));
    assert!(models.headers().get("authorization").is_none());
    let chat = build("gemini", Some("hi"), true);
    assert!(chat.url().path().ends_with("m1:generateContent"));
    let mime = &body(&chat)["generationConfig"]["responseMimeType"];
    assert_eq!(mime, "application/json");
    assert!(body(&build("gemini", Some("hi"), false))["generationConfig"].is_null());
}

#[test]
fn unsupported_provider_is_rejected() {
    let err = request("nope", "k", "m", None, false).unwrap_err();
    assert_eq!(err, "Unsupported AI provider request.");
}

#[tokio::test]
async fn send_and_test_connection_reject_unknown_providers() {
    assert_eq!(
        send("nope", "m", Some("p"), false).await.unwrap_err(),
        "Unsupported AI provider."
    );
    assert_eq!(
        test_connection("nope").await.err().as_deref(),
        Some("Unsupported AI provider.")
    );
    assert!(connection_succeeded(StatusCode::OK, true));
}

#[test]
fn client_initialisation_failures_use_the_fixed_message() {
    let broken = reqwest::Client::builder().use_preconfigured_tls(42_u8);
    assert_eq!(
        super::network_client(broken).unwrap_err(),
        "Unable to initialize the AI network client."
    );
}

#[test]
fn retarget_keeps_path_and_query_only_when_an_origin_is_given() {
    let url = "https://h.test/a/b?key=1".to_string();
    assert_eq!(super::retarget(url.clone(), None), url);
    assert_eq!(
        super::retarget(url, Some("http://127.0.0.1:9")),
        "http://127.0.0.1:9/a/b?key=1"
    );
}
