use super::*;

#[test]
fn key_names_cover_supported_providers_only() {
    assert_eq!(key_name("openai"), Ok("openai_api_key"));
    assert_eq!(key_name("claude"), Ok("claude_api_key"));
    assert_eq!(key_name("gemini"), Ok("gemini_api_key"));
    assert!(key_name("other").is_err());
}

#[test]
fn provider_key_rejects_unsupported_provider() {
    assert_eq!(
        provider_key("other"),
        Err("Unsupported AI provider.".to_string())
    );
}

#[test]
fn model_names_are_trimmed_and_bounded() {
    assert_eq!(checked_model("  gpt-4o "), Ok("gpt-4o".to_string()));
    assert!(checked_model("   ").is_err());
    assert!(checked_model(&"m".repeat(201)).is_err());
    assert!(checked_model("bad\nmodel").is_err());
}

#[test]
fn prompts_must_be_non_empty_and_bounded() {
    assert!(checked_prompt("hello").is_ok());
    assert!(checked_prompt("").is_err());
    assert!(checked_prompt(&"p".repeat(MAX_PROMPT_BYTES + 1)).is_err());
}

#[test]
fn gemini_models_url_carries_the_encoded_key() {
    assert_eq!(
        gemini_models_url("a b").unwrap(),
        "https://generativelanguage.googleapis.com/v1beta/models?key=a+b"
    );
}
