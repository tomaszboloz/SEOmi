use crate::models::config::AppConfig;
use config_storage::{load_config_file, save_config_file, CONFIG_FILE_NAME};
use secure_store::NATIVE_STORE;
use tauri::Manager;

mod config_storage;
mod credentials;
mod profiles;
mod secret_commands;
mod secret_names;
mod secure_store;
mod types;
mod validation;

pub(crate) use credentials::dataforseo_credentials;
pub(crate) use profiles::crawl_auth_profile;
pub(crate) use secure_store::secret_entry;
pub use types::{CrawlAuthProfile, CrawlProfileHeader};

#[tauri::command]
pub async fn save_crawl_auth_profile(
    project_id: String,
    profile_id: String,
    headers: Vec<CrawlProfileHeader>,
    cookie: Option<String>,
    proxy_url: Option<String>,
) -> Result<(), String> {
    profiles::save_profile(
        &project_id,
        &profile_id,
        headers,
        cookie,
        proxy_url,
        &NATIVE_STORE,
    )
}

#[tauri::command]
pub async fn delete_crawl_auth_profile(
    project_id: String,
    profile_id: String,
) -> Result<(), String> {
    profiles::delete_profile(&project_id, &profile_id, &NATIVE_STORE)
}

#[tauri::command]
pub async fn get_secret(name: String) -> Result<Option<String>, String> {
    secret_commands::read_secret(&name, &NATIVE_STORE)
}

#[tauri::command]
pub async fn set_secret(name: String, value: String) -> Result<(), String> {
    secret_commands::write_secret(&name, &value, &NATIVE_STORE)
}

#[tauri::command]
pub async fn get_config<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<AppConfig, String> {
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
pub async fn save_config<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    config: AppConfig,
) -> Result<(), String> {
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
mod command_handler_tests;
#[cfg(test)]
mod config_ipc_tests;
#[cfg(test)]
mod config_recovery_tests;
#[cfg(test)]
mod config_storage_tests;
#[cfg(test)]
mod credentials_tests;
#[cfg(test)]
mod fixture;
#[cfg(test)]
mod profile_storage_tests;
#[cfg(test)]
mod profile_validation_tests;
#[cfg(test)]
mod secret_tests;
#[cfg(test)]
mod secure_store_tests;
#[cfg(test)]
mod validation_tests;
