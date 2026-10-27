use super::{configured_key, gemini_models_url, gemini_url, provider_key};

#[test]
fn a_stored_credential_must_be_readable_and_non_blank() {
    assert_eq!(configured_key::<()>(Ok("key".into())).unwrap(), "key");
    assert_eq!(
        configured_key::<()>(Ok("  ".into())).unwrap_err(),
        "AI provider credential is not configured."
    );
    assert_eq!(
        configured_key(Err(())).unwrap_err(),
        "Unable to read the AI provider credential."
    );
}

#[test]
fn provider_keys_are_read_only_for_supported_providers() {
    assert_eq!(
        provider_key("other").unwrap_err(),
        "Unsupported AI provider."
    );
    // A pid-scoped test service never holds a credential, so reading fails closed.
    assert!(provider_key("openai").is_err());
}

#[test]
fn gemini_urls_carry_the_model_suffix_and_the_key_as_query() {
    let generate = gemini_url("gemini-2.0-flash", "k&y").unwrap();
    assert!(generate.contains("/models/gemini-2.0-flash:generateContent?key=k%26y"));
    assert!(gemini_models_url("k")
        .unwrap()
        .ends_with("/models?pageSize=1000&key=k"));
}
