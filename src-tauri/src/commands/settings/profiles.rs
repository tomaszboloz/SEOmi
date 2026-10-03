use super::{
    secret_names::crawl_auth_secret_name,
    secure_store::{SecureStore, NATIVE_STORE},
    types::{CrawlAuthProfile, CrawlProfileHeader},
    validation::validate_crawl_auth_profile,
};

pub(crate) fn crawl_auth_profile(
    project_id: &str,
    profile_id: &str,
) -> Result<CrawlAuthProfile, String> {
    load_profile(project_id, profile_id, &NATIVE_STORE)
}

pub(super) fn load_profile(
    project_id: &str,
    profile_id: &str,
    store: &impl SecureStore,
) -> Result<CrawlAuthProfile, String> {
    let secret_name = crawl_auth_secret_name(project_id, profile_id)?;
    let raw =
        store.read(&secret_name).ok().flatten().ok_or(
            "The selected request profile is not available in the system credential store.",
        )?;
    let profile = serde_json::from_str::<CrawlAuthProfile>(&raw)
        .map_err(|_| "The saved request profile is invalid. Replace it before crawling.")?;
    validate_crawl_auth_profile(&profile)?;
    Ok(profile)
}

pub(super) fn save_profile(
    project_id: &str,
    profile_id: &str,
    headers: Vec<CrawlProfileHeader>,
    cookie: Option<String>,
    proxy_url: Option<String>,
    store: &impl SecureStore,
) -> Result<(), String> {
    let secret_name = crawl_auth_secret_name(project_id, profile_id)?;
    let profile = CrawlAuthProfile {
        headers,
        cookie: cookie.filter(|value| !value.trim().is_empty()),
        proxy_url: proxy_url.filter(|value| !value.trim().is_empty()),
    };
    validate_crawl_auth_profile(&profile)?;
    let serialized =
        serde_json::to_string(&profile).map_err(|_| "Unable to serialize request profile.")?;
    store
        .write(&secret_name, &serialized)
        .map_err(|_| "Unable to save request profile in the system credential store.".into())
}

pub(super) fn delete_profile(
    project_id: &str,
    profile_id: &str,
    store: &impl SecureStore,
) -> Result<(), String> {
    let secret_name = crawl_auth_secret_name(project_id, profile_id)?;
    store
        .delete(&secret_name)
        .map_err(|_| "Unable to remove request profile from the system credential store.".into())
}
