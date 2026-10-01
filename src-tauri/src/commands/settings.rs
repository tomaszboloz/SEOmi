use crate::models::config::AppConfig;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use tauri::Manager;

const MAX_CONFIG_BYTES: u64 = 64 * 1024;

const CONFIG_FILE_NAME: &str = "seomi_config.json";
const KEYRING_SERVICE: &str = "so.seomi.desktop";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlProfileHeader {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrawlAuthProfile {
    pub headers: Vec<CrawlProfileHeader>,
    pub cookie: Option<String>,
    #[serde(default)]
    pub proxy_url: Option<String>,
}

fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

fn valid_secret_suffix(name: &str, prefix: &str) -> bool {
    name.strip_prefix(prefix).is_some_and(valid_identifier)
}

fn crawl_auth_secret_name(project_id: &str, profile_id: &str) -> Result<String, String> {
    if !valid_identifier(project_id) || !valid_identifier(profile_id) {
        return Err("Invalid project or request-profile identifier.".into());
    }
    Ok(format!("crawl_auth_{project_id}_{profile_id}"))
}

fn validate_crawl_auth_profile(profile: &CrawlAuthProfile) -> Result<(), String> {
    if profile.headers.len() > 50 {
        return Err("A request profile supports at most 50 custom headers.".into());
    }
    for header in &profile.headers {
        let name = header.name.trim();
        if name.is_empty()
            || name.len() > 256
            || reqwest::header::HeaderName::from_bytes(name.as_bytes()).is_err()
        {
            return Err(format!("Invalid custom header name `{}`.", header.name));
        }
        if matches!(
            name.to_ascii_lowercase().as_str(),
            "host"
                | "content-length"
                | "connection"
                | "transfer-encoding"
                | "cookie"
                | "user-agent"
        ) {
            return Err(format!(
                "The `{name}` header must be configured through its dedicated control."
            ));
        }
        if header.value.len() > 8_192
            || reqwest::header::HeaderValue::from_str(&header.value).is_err()
        {
            return Err(format!("Invalid value for custom header `{name}`."));
        }
    }
    if let Some(cookie) = &profile.cookie {
        if cookie.len() > 16_384 || reqwest::header::HeaderValue::from_str(cookie).is_err() {
            return Err("Invalid cookie value in request profile.".into());
        }
    }
    if let Some(proxy_url) = &profile.proxy_url {
        if proxy_url.len() > 2_048 {
            return Err("Proxy URL cannot exceed 2048 characters.".into());
        }
        let proxy =
            url::Url::parse(proxy_url).map_err(|_| "Invalid proxy URL in request profile.")?;
        if !matches!(proxy.scheme(), "http" | "https") || proxy.host_str().is_none() {
            return Err("Proxy URL must use HTTP or HTTPS and include a hostname.".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_scoped_google_refresh_tokens_are_allowed_in_secure_storage() {
        assert!(is_supported_secret_name("gsc_refresh_token_project-1"));
        assert!(is_gsc_refresh_secret("gsc_refresh_token_project-1"));
        assert!(!is_supported_secret_name("gsc_refresh_token_"));
        assert!(!is_supported_secret_name(
            "gsc_refresh_token_project/../outside"
        ));
    }

    #[test]
    fn google_performance_api_keys_are_project_scoped() {
        assert!(is_supported_secret_name("google_metrics_api_key_project-1"));
        assert!(!is_supported_secret_name("google_metrics_api_key_"));
        assert!(!is_supported_secret_name(
            "google_metrics_api_key_project/../other"
        ));
    }

    #[test]
    fn crawl_auth_profile_rejects_transport_control_headers() {
        let profile = CrawlAuthProfile {
            headers: vec![CrawlProfileHeader {
                name: "Host".into(),
                value: "internal.example".into(),
            }],
            cookie: None,
            proxy_url: None,
        };

        assert!(validate_crawl_auth_profile(&profile)
            .unwrap_err()
            .contains("dedicated control"));
    }

    #[test]
    fn crawl_auth_profile_accepts_authorization_and_cookie_in_the_keychain_payload() {
        let profile = CrawlAuthProfile {
            headers: vec![CrawlProfileHeader {
                name: "Authorization".into(),
                value: "Bearer test-token".into(),
            }],
            cookie: Some("session=test".into()),
            proxy_url: Some("https://user:password@proxy.example:8443".into()),
        };

        assert!(validate_crawl_auth_profile(&profile).is_ok());
        assert_eq!(
            crawl_auth_secret_name("project-1", "profile-1").unwrap(),
            "crawl_auth_project-1_profile-1"
        );
    }

    #[test]
    fn crawl_auth_profile_rejects_non_http_proxy_schemes() {
        let profile = CrawlAuthProfile {
            headers: Vec::new(),
            cookie: None,
            proxy_url: Some("file:///tmp/proxy".into()),
        };

        assert!(validate_crawl_auth_profile(&profile)
            .unwrap_err()
            .contains("HTTP or HTTPS"));
    }
}

fn is_supported_secret_name(name: &str) -> bool {
    let is_ai_key = matches!(name, "openai_api_key" | "claude_api_key" | "gemini_api_key");
    let is_project_google_metrics_key = valid_secret_suffix(name, "google_metrics_api_key_");
    let is_project_dataforseo_key = valid_secret_suffix(name, "dataforseo_login_")
        || valid_secret_suffix(name, "dataforseo_password_");
    let is_crawl_auth_key = name
        .strip_prefix("crawl_auth_")
        .and_then(|suffix| suffix.split_once('_'))
        .is_some_and(|(project, profile)| valid_identifier(project) && valid_identifier(profile));
    let is_gsc_refresh_key = is_gsc_refresh_secret(name);
    let is_gsc_client_key = is_gsc_client_secret(name);
    is_ai_key
        || is_project_google_metrics_key
        || is_project_dataforseo_key
        || is_crawl_auth_key
        || is_gsc_refresh_key
        || is_gsc_client_key
}

fn is_gsc_refresh_secret(name: &str) -> bool {
    valid_secret_suffix(name, "gsc_refresh_token_")
}

fn is_gsc_client_secret(name: &str) -> bool {
    valid_secret_suffix(name, "gsc_client_secret_")
}

pub(crate) fn secret_entry(name: &str) -> Result<keyring::Entry, String> {
    if !is_supported_secret_name(name) {
        return Err("Unsupported secure setting.".to_string());
    }
    keyring::Entry::new(KEYRING_SERVICE, name)
        .map_err(|error| format!("Unable to access the system credential store: {error}"))
}

pub(crate) fn dataforseo_credentials(project_id: &str) -> Result<(String, String), String> {
    if !valid_identifier(project_id) {
        return Err("Invalid project identifier for DataForSEO request.".into());
    }
    let login = secret_entry(&format!("dataforseo_login_{project_id}"))?
        .get_password()
        .map_err(|_| "DataForSEO login is not configured for this project.".to_string())?;
    let password = secret_entry(&format!("dataforseo_password_{project_id}"))?
        .get_password()
        .map_err(|_| "DataForSEO password is not configured for this project.".to_string())?;
    if login.trim().is_empty() || password.is_empty() {
        return Err("DataForSEO credentials are incomplete for this project.".into());
    }
    Ok((login, password))
}

pub(crate) fn crawl_auth_profile(
    project_id: &str,
    profile_id: &str,
) -> Result<CrawlAuthProfile, String> {
    let secret_name = crawl_auth_secret_name(project_id, profile_id)?;
    let raw = secret_entry(&secret_name)?.get_password().map_err(|_| {
        "The selected request profile is not available in the system credential store.".to_string()
    })?;
    let profile = serde_json::from_str::<CrawlAuthProfile>(&raw).map_err(|_| {
        "The saved request profile is invalid. Replace it before crawling.".to_string()
    })?;
    validate_crawl_auth_profile(&profile)?;
    Ok(profile)
}

#[tauri::command]
pub async fn save_crawl_auth_profile(
    project_id: String,
    profile_id: String,
    headers: Vec<CrawlProfileHeader>,
    cookie: Option<String>,
    proxy_url: Option<String>,
) -> Result<(), String> {
    let secret_name = crawl_auth_secret_name(&project_id, &profile_id)?;
    let profile = CrawlAuthProfile {
        headers,
        cookie: cookie.filter(|value| !value.trim().is_empty()),
        proxy_url: proxy_url.filter(|value| !value.trim().is_empty()),
    };
    validate_crawl_auth_profile(&profile)?;
    let serialized = serde_json::to_string(&profile)
        .map_err(|error| format!("Unable to serialize request profile: {error}"))?;
    secret_entry(&secret_name)?
        .set_password(&serialized)
        .map_err(|error| {
            format!("Unable to save request profile in the system credential store: {error}")
        })
}

#[tauri::command]
pub async fn delete_crawl_auth_profile(
    project_id: String,
    profile_id: String,
) -> Result<(), String> {
    let secret_name = crawl_auth_secret_name(&project_id, &profile_id)?;
    match secret_entry(&secret_name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!(
            "Unable to remove request profile from the system credential store: {error}"
        )),
    }
}

#[tauri::command]
pub async fn get_secret(name: String) -> Result<Option<String>, String> {
    if is_gsc_refresh_secret(&name) {
        return Err("Search Console refresh tokens are not exposed to the frontend.".into());
    }
    let entry = secret_entry(&name)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Unable to read secure setting: {error}")),
    }
}

#[tauri::command]
pub async fn set_secret(name: String, value: String) -> Result<(), String> {
    if is_gsc_refresh_secret(&name) {
        return Err(
            "Search Console refresh tokens can only be managed by the native OAuth workflow."
                .into(),
        );
    }
    let entry = secret_entry(&name)?;
    if value.trim().is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!("Unable to remove secure setting: {error}")),
        }
    } else {
        entry
            .set_password(&value)
            .map_err(|error| format!("Unable to save secure setting: {error}"))
    }
}

fn load_config_file(path: &Path) -> Result<AppConfig, String> {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(AppConfig::default())
        }
        Err(_) => return Err("Unable to read configuration file.".into()),
    };
    let mut bytes = Vec::new();
    file.take(MAX_CONFIG_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Unable to read configuration file.")?;
    if bytes.len() as u64 > MAX_CONFIG_BYTES {
        return Err("Configuration exceeds the size limit.".into());
    }
    let mut config: AppConfig = serde_json::from_slice(&bytes)
        .map_err(|_| "Saved configuration is invalid. Restore a valid configuration file.")?;
    if config.default_user_agent == "chrome_desktop" {
        config.default_user_agent = "chrome_mac".into();
    }
    config.validate()?;
    Ok(config)
}

fn save_config_file(path: &Path, config: &AppConfig) -> Result<(), String> {
    config.validate()?;
    let bytes =
        serde_json::to_vec_pretty(config).map_err(|_| "Unable to serialize configuration.")?;
    if bytes.len() as u64 > MAX_CONFIG_BYTES {
        return Err("Configuration exceeds the size limit.".into());
    }
    let directory = path
        .parent()
        .ok_or("Configuration directory is unavailable.")?;
    fs::create_dir_all(directory).map_err(|_| "Unable to create configuration directory.")?;
    let temporary = directory.join(format!(".seomi-config-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| -> std::io::Result<()> {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        drop(file);
        super::crawl_storage::replace_file(&temporary, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result.map_err(|_| {
        "Unable to save configuration atomically. Existing settings were preserved.".into()
    })
}

#[tauri::command]
pub async fn get_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|_| "Configuration directory is unavailable.")?
        .join(CONFIG_FILE_NAME);
    tokio::task::spawn_blocking(move || load_config_file(&path))
        .await
        .map_err(|_| "Configuration read task failed.")?
}

#[tauri::command]
pub async fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    config.validate()?;
    let path = app
        .path()
        .app_config_dir()
        .map_err(|_| "Configuration directory is unavailable.")?
        .join(CONFIG_FILE_NAME);
    tokio::task::spawn_blocking(move || save_config_file(&path, &config))
        .await
        .map_err(|_| "Configuration save task failed.")?
}

#[cfg(test)]
mod config_storage_tests {
    use super::*;
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
}
