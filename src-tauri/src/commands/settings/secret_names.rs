pub(super) fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

pub(super) fn valid_secret_suffix(name: &str, prefix: &str) -> bool {
    name.strip_prefix(prefix).is_some_and(valid_identifier)
}

pub(super) fn crawl_auth_secret_name(project_id: &str, profile_id: &str) -> Result<String, String> {
    if !valid_identifier(project_id) || !valid_identifier(profile_id) {
        return Err("Invalid project or request-profile identifier.".into());
    }
    Ok(format!("crawl_auth_{project_id}_{profile_id}"))
}
pub(super) fn is_supported_secret_name(name: &str) -> bool {
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

pub(super) fn is_gsc_refresh_secret(name: &str) -> bool {
    valid_secret_suffix(name, "gsc_refresh_token_")
}

pub(super) fn is_gsc_client_secret(name: &str) -> bool {
    valid_secret_suffix(name, "gsc_client_secret_")
}
