use super::models::{claude_models, gemini_models, openai_models};
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
    assert_eq!(ids, ["o3-mini", "chatgpt-4o-latest"]);
    assert!(openai_models(&json!({})).is_empty());
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
    assert_eq!(
        (models[0].id.as_str(), models[0].label.as_str()),
        ("gemini-c", "gemini-c")
    );
}
