use super::{config_storage::*, secret_names::*};
use crate::models::config::AppConfig;
use std::fs;

fn config_fixture() -> std::path::PathBuf {
    let directory =
        std::env::temp_dir().join(format!("seomi-config-test-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    directory.join(CONFIG_FILE_NAME)
}

#[test]
fn config_storage_round_trip_replaces_existing_file_and_migrates_legacy_agent() {
    let path = config_fixture();
    let mut config = load_config_file(&path).unwrap();
    save_config_file(&path, &config).unwrap();
    config.theme = "light".into();
    save_config_file(&path, &config).unwrap();
    assert_eq!(load_config_file(&path).unwrap().theme, "light");
    config.default_user_agent = "chrome_desktop".into();
    fs::write(&path, serde_json::to_vec(&config).unwrap()).unwrap();
    assert_eq!(
        load_config_file(&path).unwrap().default_user_agent,
        "chrome_mac"
    );
    assert_eq!(fs::read_dir(path.parent().unwrap()).unwrap().count(), 1);
    fs::remove_dir_all(path.parent().unwrap()).unwrap();
}

#[test]
fn corrupt_and_oversized_config_is_an_error_and_invalid_save_preserves_existing_file() {
    let path = config_fixture();
    fs::write(&path, "broken JSON").unwrap();
    assert!(load_config_file(&path).unwrap_err().contains("invalid"));
    fs::write(&path, vec![b' '; MAX_CONFIG_BYTES as usize + 1]).unwrap();
    assert!(load_config_file(&path).unwrap_err().contains("limit"));
    let config = AppConfig::default();
    save_config_file(&path, &config).unwrap();
    let before = fs::read(&path).unwrap();
    let invalid = AppConfig {
        request_timeout_secs: 0,
        ..config
    };
    assert!(save_config_file(&path, &invalid).is_err());
    assert_eq!(fs::read(&path).unwrap(), before);
    fs::remove_dir_all(path.parent().unwrap()).unwrap();
}
#[test]
fn failed_atomic_replace_cleans_temporary_file_and_preserves_destination() {
    let path = config_fixture();
    fs::create_dir(&path).unwrap();
    fs::write(path.join("preserved"), "original").unwrap();
    assert!(save_config_file(&path, &AppConfig::default()).is_err());
    assert_eq!(
        fs::read_to_string(path.join("preserved")).unwrap(),
        "original"
    );
    assert_eq!(fs::read_dir(path.parent().unwrap()).unwrap().count(), 1);
    fs::remove_dir_all(path.parent().unwrap()).unwrap();
}

#[test]
fn secret_names_keep_project_scopes_and_reject_ambiguous_suffixes() {
    for prefix in [
        "google_metrics_api_key_",
        "dataforseo_login_",
        "dataforseo_password_",
        "gsc_refresh_token_",
        "gsc_client_secret_",
    ] {
        assert!(is_supported_secret_name(&format!("{prefix}project-1")));
        for suffix in [
            "",
            "project/1",
            "project_1",
            " project",
            "project\n",
            &"x".repeat(81),
        ] {
            assert!(!is_supported_secret_name(&format!("{prefix}{suffix}")));
        }
    }
    assert!(is_supported_secret_name("crawl_auth_project-1_profile-2"));
    for invalid in [
        "crawl_auth_project_profile_extra",
        "crawl_auth__profile",
        "crawl_auth_project_",
        "unknown_api_key",
    ] {
        assert!(!is_supported_secret_name(invalid));
    }
}
