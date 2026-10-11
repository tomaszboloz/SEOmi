use super::models::{claude_models, gemini_models, openai_models};
use super::transport::{connection_succeeded, gemini_url};
use reqwest::StatusCode;
use serde_json::json;

#[test]
fn gemini_generation_url_keeps_method_on_the_model_segment() {
    assert_eq!(
        gemini_url("gemini-2.0-flash", "test-key").unwrap(),
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=test-key"
    );
}

#[test]
fn connection_requires_a_success_status_and_valid_json() {
    assert!(connection_succeeded(StatusCode::OK, true));
    assert!(!connection_succeeded(StatusCode::OK, false));
    assert!(!connection_succeeded(StatusCode::UNAUTHORIZED, true));
}

#[test]
fn model_contracts_filter_non_generation_models_and_labels() {
    let openai =
        openai_models(&json!({ "data": [{ "id": "gpt-4o" }, { "id": "text-embedding-3-small" }] }));
    assert_eq!(
        openai
            .iter()
            .map(|item| item.id.as_str())
            .collect::<Vec<_>>(),
        ["gpt-4o"]
    );
    let claude =
        claude_models(&json!({ "data": [{ "id": "claude-x", "display_name": "Claude X" }] }));
    assert_eq!(claude[0].label, "Claude X");
    let gemini = gemini_models(
        &json!({ "models": [{ "name": "models/gemini-x", "displayName": "Gemini X", "supportedGenerationMethods": ["generateContent"] }] }),
    );
    assert_eq!(gemini[0].id, "gemini-x");
}
