pub(super) fn validate_client_id(client_id: &str) -> Result<String, String> {
    let value = client_id.trim();
    if value.len() > 255
        || !value.ends_with(".apps.googleusercontent.com")
        || value.contains(char::is_whitespace)
    {
        return Err("Enter a valid Desktop app OAuth Client ID from Google Cloud Console.".into());
    }
    Ok(value.to_string())
}

pub(super) fn refresh_token_key(project_id: &str) -> Result<String, String> {
    if !project_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
        || !(1..=80).contains(&project_id.len())
    {
        return Err("Invalid Google Search Console project identifier.".into());
    }
    Ok(format!("gsc_refresh_token_{project_id}"))
}

pub(super) fn client_secret_key(project_id: &str) -> Result<String, String> {
    if !project_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
        || !(1..=80).contains(&project_id.len())
    {
        return Err("Invalid Search Console project identifier.".into());
    }
    Ok(format!("gsc_client_secret_{project_id}"))
}
