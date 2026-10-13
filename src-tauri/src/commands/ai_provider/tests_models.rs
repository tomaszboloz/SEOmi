use super::models::{claude_models, gemini_models, openai_models, select_models};
use reqwest::StatusCode;
use serde_json::json;

#[test]
fn openai_models_skip_missing_ids_excluded_families_and_non_chat_ids() {
    let body = json!({ "data": [
        { "name": "no-id" },
        { "id": "gpt-4o-audio-preview" },
        { "id": "whisper-1" },
        { "id": "ft:custom" },
        { "id": "o3-mini" },
        { "id": "chatgpt-4o-latest" }
    ] });
    let ids: Vec<_> = openai_models(&body).into_iter().map(|m| m.id).collect();
    assert_eq!(ids, ["chatgpt-4o-latest", "o3-mini"]);
    assert!(openai_models(&json!({})).is_empty());
}

#[test]
fn openai_models_are_newest_first_without_models_chat_completions_rejects() {
    let body = json!({ "data": [
        { "id": "gpt-4o", "created": 10 },
        { "id": "gpt-6.1-sol", "created": 30 },
        { "id": "gpt-5.5-pro", "created": 40 },
        { "id": "gpt-5.3-codex", "created": 40 },
        { "id": "gpt-3.5-turbo-instruct", "created": 40 },
        { "id": "gpt-live-1", "created": 40 },
        { "id": "gpt-5.4-mini", "created": 20 },
        { "id": "gpt-5.4", "created": 20 },
        { "id": "gpt-4" }
    ] });
    let ids: Vec<_> = openai_models(&body).into_iter().map(|m| m.id).collect();
    let expected = ["gpt-6.1-sol", "gpt-5.4", "gpt-5.4-mini", "gpt-4o", "gpt-4"];
    assert_eq!(ids, expected);
}

#[test]
fn claude_models_fall_back_to_the_id_and_skip_missing_ids() {
    let body = json!({ "data": [
        { "display_name": "orphan" },
        { "id": "claude-a", "display_name": "" },
        { "id": "claude-b" }
    ] });
    let labels: Vec<_> = claude_models(&body).into_iter().map(|m| m.label).collect();
    assert_eq!(labels, ["claude-a", "claude-b"]);
}

#[test]
fn gemini_models_require_name_methods_prefix_and_generation() {
    let body = json!({ "models": [
        { "displayName": "nameless" },
        { "name": "models/gemini-a" },
        { "name": "models/embed", "supportedGenerationMethods": ["generateContent"] },
        { "name": "models/gemini-b", "supportedGenerationMethods": ["embedContent"] },
        { "name": "gemini-c", "supportedGenerationMethods": ["generateContent"] }
    ] });
    let models = gemini_models(&body);
    assert_eq!(models.len(), 1);
    let speech = json!({ "models": [
        { "name": "models/gemini-3.8-flash-tts", "supportedGenerationMethods": ["generateContent"] },
        { "name": "models/gemini-3.1-flash-image", "supportedGenerationMethods": ["generateContent"] },
        { "name": "models/gemini-3.5-transcribe", "supportedGenerationMethods": ["generateContent"] }
    ] });
    assert!(gemini_models(&speech).is_empty());
    assert_eq!(
        (models[0].id.as_str(), models[0].label.as_str()),
        ("gemini-c", "gemini-c")
    );
}

#[test]
fn select_models_dispatches_per_provider_and_bounds_the_list() {
    let ok = |body| Ok((StatusCode::OK, body));
    let data: Vec<_> = (0..400)
        .map(|i| json!({ "id": format!("gpt-{i}") }))
        .collect();
    assert_eq!(
        select_models("openai", ok(json!({ "data": data })))
            .unwrap()
            .len(),
        300
    );
    assert_eq!(
        select_models("claude", ok(json!({ "data": [{ "id": "c1" }] }))).unwrap()[0].id,
        "c1"
    );
    assert!(select_models("gemini", ok(json!({ "models": [] })))
        .unwrap()
        .is_empty());
    assert_eq!(
        select_models("none", ok(json!({}))).unwrap_err(),
        "Unsupported AI provider."
    );
    assert_eq!(
        select_models("openai", Err("boom".into())).unwrap_err(),
        "boom"
    );
}
