use super::{
    secret_names::valid_identifier,
    secure_store::{SecureStore, NATIVE_STORE},
};

pub(crate) fn dataforseo_credentials(project_id: &str) -> Result<(String, String), String> {
    credentials_with(project_id, &NATIVE_STORE)
}

pub(super) fn credentials_with(
    project_id: &str,
    store: &impl SecureStore,
) -> Result<(String, String), String> {
    if !valid_identifier(project_id) {
        return Err("Invalid project identifier for DataForSEO request.".into());
    }
    let login = store
        .read(&format!("dataforseo_login_{project_id}"))
        .ok()
        .flatten()
        .ok_or("DataForSEO login is not configured for this project.")?;
    let password = store
        .read(&format!("dataforseo_password_{project_id}"))
        .ok()
        .flatten()
        .ok_or("DataForSEO password is not configured for this project.")?;
    if login.trim().is_empty() || password.is_empty() {
        return Err("DataForSEO credentials are incomplete for this project.".into());
    }
    Ok((login, password))
}
