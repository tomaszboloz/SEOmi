use super::config_storage::*;
use crate::models::config::AppConfig;
use std::fs;

fn temp_config_path() -> (std::path::PathBuf, std::path::PathBuf) {
    let dir = std::env::temp_dir().join(format!("seomi-cfg-rec-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&dir).unwrap();
    let file = dir.join(CONFIG_FILE_NAME);
    (dir, file)
}

#[test]
fn corrupted_config_recovers_to_fallback_defaults() {
    let (dir, path) = temp_config_path();

    let default_cfg = load_config_file(&path).unwrap();
    assert_eq!(default_cfg.theme, "dark");
    assert_eq!(default_cfg.language, "en");
    assert_eq!(default_cfg.default_user_agent, "chrome_mac");

    fs::write(&path, b"{ broken JSON corrupt settings").unwrap();
    let err = load_config_file(&path).unwrap_err();
    assert!(err.contains("Saved configuration is invalid"));

    let fallback = AppConfig::default();
    save_config_file(&path, &fallback).unwrap();

    let recovered = load_config_file(&path).unwrap();
    assert_eq!(recovered.theme, "dark");
    assert_eq!(recovered.request_timeout_secs, 15);

    let _ = fs::remove_dir_all(dir);
}

#[test]
fn app_config_validation_checks_all_domain_fields() {
    let base = AppConfig::default();

    let bad_theme = AppConfig {
        theme: "invalid_theme".into(),
        ..base.clone()
    };
    assert_eq!(
        bad_theme.validate().unwrap_err(),
        "Unsupported configuration theme."
    );

    let bad_lang = AppConfig {
        language: "esperanto".into(),
        ..base.clone()
    };
    assert_eq!(
        bad_lang.validate().unwrap_err(),
        "Unsupported configuration language."
    );

    let bad_provider = AppConfig {
        ai_provider: "anthropic_unsupported".into(),
        ..base.clone()
    };
    assert_eq!(
        bad_provider.validate().unwrap_err(),
        "Unsupported AI provider."
    );

    let bad_timeout_low = AppConfig {
        request_timeout_secs: 0,
        ..base.clone()
    };
    assert_eq!(
        bad_timeout_low.validate().unwrap_err(),
        "Request timeout must be between 1 and 60 seconds."
    );
    let bad_timeout_high = AppConfig {
        request_timeout_secs: 61,
        ..base.clone()
    };
    assert_eq!(
        bad_timeout_high.validate().unwrap_err(),
        "Request timeout must be between 1 and 60 seconds."
    );

    let bad_redirects = AppConfig {
        max_redirects: 21,
        ..base.clone()
    };
    assert_eq!(
        bad_redirects.validate().unwrap_err(),
        "Redirect limit must be between 0 and 20."
    );

    let bad_agent = AppConfig {
        default_user_agent: "   ".into(),
        ..base.clone()
    };
    assert_eq!(
        bad_agent.validate().unwrap_err(),
        "Invalid default user agent."
    );

    let bad_model = AppConfig {
        ai_model: Some("   ".into()),
        ..base.clone()
    };
    assert_eq!(
        bad_model.validate().unwrap_err(),
        "Invalid AI model identifier."
    );
    let ctrl_model = AppConfig {
        ai_model: Some("model\nname".into()),
        ..base
    };
    assert_eq!(
        ctrl_model.validate().unwrap_err(),
        "Invalid AI model identifier."
    );
}
