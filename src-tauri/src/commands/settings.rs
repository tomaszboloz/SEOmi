use crate::models::config::AppConfig;
use regex::Regex;
use std::fs;
use tauri::Manager;

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
    Regex::new(r"^[a-zA-Z0-9-]{1,80}$")
        .map(|pattern| pattern.is_match(value))
        .unwrap_or(false)
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
    let is_project_google_metrics_key = Regex::new(r"^google_metrics_api_key_[a-zA-Z0-9-]{1,80}$")
        .map(|pattern| pattern.is_match(name))
        .unwrap_or(false);
    let is_project_dataforseo_key = Regex::new(r"^dataforseo_(login|password)_[a-zA-Z0-9-]{1,80}$")
        .map(|pattern| pattern.is_match(name))
        .unwrap_or(false);
    let is_crawl_auth_key = Regex::new(r"^crawl_auth_[a-zA-Z0-9-]{1,80}_[a-zA-Z0-9-]{1,80}$")
        .map(|pattern| pattern.is_match(name))
        .unwrap_or(false);
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
    Regex::new(r"^gsc_refresh_token_[a-zA-Z0-9-]{1,80}$")
        .map(|pattern| pattern.is_match(name))
        .unwrap_or(false)
}

fn is_gsc_client_secret(name: &str) -> bool {
    Regex::new(r"^gsc_client_secret_[a-zA-Z0-9-]{1,80}$")
        .map(|pattern| pattern.is_match(name))
        .unwrap_or(false)
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

#[tauri::command]
pub async fn get_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve config dir: {}", e))?;

    let file_path = config_dir.join(CONFIG_FILE_NAME);
    if !file_path.exists() {
        return Ok(AppConfig::default());
    }

    let content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read config file: {}", e))?;

    let config: AppConfig = serde_json::from_str(&content).unwrap_or_else(|_| AppConfig::default());

    Ok(config)
}

#[tauri::command]
pub async fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve config dir: {}", e))?;

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    let file_path = config_dir.join(CONFIG_FILE_NAME);
    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&file_path, serialized).map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}
