use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: String,    // "dark" | "light" | "system"
    pub language: String, // "en", "pl", etc.
    pub default_user_agent: String,
    pub request_timeout_secs: u64,
    pub max_redirects: usize,
    pub verify_ssl: bool,
    pub ai_provider: String, // "openai" | "claude" | "gemini"
    pub ai_model: Option<String>,
    pub auto_check_updates: bool,
    #[serde(default = "default_auto_install_updates")]
    pub auto_install_updates: bool,
}

fn default_auto_install_updates() -> bool {
    false
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            language: "en".to_string(),
            default_user_agent: "chrome_mac".to_string(),
            request_timeout_secs: 15,
            max_redirects: 10,
            verify_ssl: true,
            ai_provider: "openai".to_string(),
            ai_model: Some("gpt-4o".to_string()),
            auto_check_updates: true,
            auto_install_updates: false,
        }
    }
}

impl AppConfig {
    pub fn validate(&self) -> Result<(), String> {
        if !matches!(self.theme.as_str(), "dark" | "light" | "system") {
            return Err("Unsupported configuration theme.".into());
        }
        if !matches!(
            self.language.as_str(),
            "en" | "pl" | "es" | "de" | "fr" | "it" | "pt" | "ru" | "ja" | "zh" | "ko" | "ar"
        ) {
            return Err("Unsupported configuration language.".into());
        }
        if !matches!(self.ai_provider.as_str(), "openai" | "claude" | "gemini") {
            return Err("Unsupported AI provider.".into());
        }
        if !(1..=60).contains(&self.request_timeout_secs) {
            return Err("Request timeout must be between 1 and 60 seconds.".into());
        }
        if self.max_redirects > 20 {
            return Err("Redirect limit must be between 0 and 20.".into());
        }
        if self.default_user_agent.trim().is_empty()
            || self.default_user_agent.len() > 1024
            || reqwest::header::HeaderValue::from_str(&self.default_user_agent).is_err()
        {
            return Err("Invalid default user agent.".into());
        }
        if self.ai_model.as_ref().is_some_and(|model| {
            model.trim().is_empty() || model.len() > 200 || model.chars().any(char::is_control)
        }) {
            return Err("Invalid AI model identifier.".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
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
}
