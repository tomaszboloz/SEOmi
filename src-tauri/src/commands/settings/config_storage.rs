use crate::models::config::AppConfig;
use std::{
    fs,
    io::{Read, Write},
    path::Path,
};

pub(super) const MAX_CONFIG_BYTES: u64 = 64 * 1024;
pub(super) const CONFIG_FILE_NAME: &str = "seomi_config.json";

pub(super) fn load_config_file(path: &Path) -> Result<AppConfig, String> {
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

pub(super) fn save_config_file(path: &Path, config: &AppConfig) -> Result<(), String> {
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
        super::super::crawl_storage::replace_file(&temporary, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result.map_err(|_| {
        "Unable to save configuration atomically. Existing settings were preserved.".into()
    })
}
