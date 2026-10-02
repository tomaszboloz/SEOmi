use super::{
    secret_names::{is_gsc_refresh_secret, is_supported_secret_name},
    secure_store::SecureStore,
};

fn validate_frontend_secret(name: &str, write: bool) -> Result<(), String> {
    if is_gsc_refresh_secret(name) {
        return Err(if write {
            "Search Console refresh tokens can only be managed by the native OAuth workflow."
        } else {
            "Search Console refresh tokens are not exposed to the frontend."
        }
        .into());
    }
    if !is_supported_secret_name(name) {
        return Err("Unsupported secure setting.".into());
    }
    Ok(())
}

pub(super) fn read_secret(name: &str, store: &impl SecureStore) -> Result<Option<String>, String> {
    validate_frontend_secret(name, false)?;
    store
        .read(name)
        .map_err(|_| "Unable to read secure setting.".into())
}

pub(super) fn write_secret(
    name: &str,
    value: &str,
    store: &impl SecureStore,
) -> Result<(), String> {
    validate_frontend_secret(name, true)?;
    if value.trim().is_empty() {
        store
            .delete(name)
            .map_err(|_| "Unable to remove secure setting.".into())
    } else {
        store
            .write(name, value)
            .map_err(|_| "Unable to save secure setting.".into())
    }
}
