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
            default_user_agent: "chrome_desktop".to_string(),
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
