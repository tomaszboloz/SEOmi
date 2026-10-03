use crate::commands::settings::secret_entry;
use crate::utils::url_validator::validate_and_normalize_url;
use url::Url;

pub(super) fn validate_project_id(project_id: &str) -> Result<(), String> {
    if project_id.is_empty()
        || project_id.len() > 80
        || !project_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Invalid project identifier for Google performance request.".into());
    }
    Ok(())
}

pub(super) fn google_metrics_key(project_id: &str) -> Result<String, String> {
    google_metrics_key_with(project_id, |name| {
        secret_entry(name)?.get_password().map_err(|_| {
            "Add a Google PageSpeed Insights / CrUX API key in this project's Settings.".to_string()
        })
    })
}

pub(super) fn google_metrics_key_with(
    project_id: &str,
    read: impl FnOnce(&str) -> Result<String, String>,
) -> Result<String, String> {
    validate_project_id(project_id)?;
    let key = read(&format!("google_metrics_api_key_{project_id}"))?;
    if key.trim().is_empty() {
        return Err(
            "Google performance API key is empty. Configure it in this project's Settings.".into(),
        );
    }
    Ok(key)
}

pub(super) fn target_url(input: &str) -> Result<Url, String> {
    if input.len() > 4_096 {
        return Err("Target URL cannot exceed 4096 characters.".into());
    }
    let mut target = validate_and_normalize_url(input).map_err(|error| error.to_string())?;
    if !target.username().is_empty() || target.password().is_some() {
        return Err("Target URL must not contain a username or password.".into());
    }
    target.set_fragment(None);
    Ok(target)
}

pub(super) fn validate_strategy(strategy: &str) -> Result<&'static str, String> {
    match strategy {
        "mobile" => Ok("mobile"),
        "desktop" => Ok("desktop"),
        _ => Err("PageSpeed strategy must be mobile or desktop.".into()),
    }
}

pub(super) fn validate_form_factor(form_factor: &str) -> Result<&'static str, String> {
    match form_factor {
        "PHONE" => Ok("PHONE"),
        "DESKTOP" => Ok("DESKTOP"),
        "TABLET" => Ok("TABLET"),
        _ => Err("CrUX form factor must be PHONE, DESKTOP, or TABLET.".into()),
    }
}
