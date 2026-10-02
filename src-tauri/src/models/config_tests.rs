use super::*;

#[test]
fn defaults_use_a_supported_user_agent_and_validate() {
    let config = AppConfig::default();
    assert_eq!(config.default_user_agent, "chrome_mac");
    assert!(config.validate().is_ok());
}

#[test]
fn rejects_invalid_config_fields_and_accepts_request_boundaries() {
    for field in [
        "theme",
        "language",
        "ai_provider",
        "default_user_agent",
        "ai_model",
        "request_timeout_secs",
        "max_redirects",
    ] {
        let mut value = serde_json::to_value(AppConfig::default()).unwrap();
        value[field] = match field {
            "request_timeout_secs" => serde_json::json!(0),
            "max_redirects" => serde_json::json!(21),
            "default_user_agent" => serde_json::json!("agent\r\nInjected: value"),
            "ai_model" => serde_json::json!("x".repeat(201)),
            _ => serde_json::json!("invalid"),
        };
        let config: AppConfig = serde_json::from_value(value).unwrap();
        assert!(config.validate().is_err(), "{field}");
    }
    for (timeout, redirects) in [(1, 0), (60, 20)] {
        let config = AppConfig {
            request_timeout_secs: timeout,
            max_redirects: redirects,
            ..AppConfig::default()
        };
        assert!(config.validate().is_ok());
    }
}
#[test]
fn validates_string_limits_and_all_supported_enums() {
    for language in [
        "en", "pl", "es", "de", "fr", "it", "pt", "ru", "ja", "zh", "ko", "ar",
    ] {
        for theme in ["dark", "light", "system"] {
            for provider in ["openai", "claude", "gemini"] {
                assert!(AppConfig {
                    language: language.into(),
                    theme: theme.into(),
                    ai_provider: provider.into(),
                    ai_model: None,
                    ..AppConfig::default()
                }
                .validate()
                .is_ok());
            }
        }
    }
    for agent in ["", "x".repeat(1025).as_str(), "agent\n"] {
        assert!(AppConfig {
            default_user_agent: agent.into(),
            ..AppConfig::default()
        }
        .validate()
        .is_err());
    }
    for model in ["", "model\n"] {
        assert!(AppConfig {
            ai_model: Some(model.into()),
            ..AppConfig::default()
        }
        .validate()
        .is_err());
    }
    assert!(AppConfig {
        request_timeout_secs: 61,
        ..AppConfig::default()
    }
    .validate()
    .is_err());
}
