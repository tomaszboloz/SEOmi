use serde::Serialize;
use tauri::{AppHandle, Runtime};
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Serialize)]
pub struct UpdateStatus {
    pub available: bool,
    pub installed: bool,
    pub restart_required: bool,
    pub version: Option<String>,
    pub current_version: String,
}

fn no_update() -> UpdateStatus {
    UpdateStatus {
        available: false,
        installed: false,
        restart_required: false,
        version: None,
        current_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

fn check_error(error: tauri_plugin_updater::Error) -> Result<UpdateStatus, String> {
    match error {
        tauri_plugin_updater::Error::ReleaseNotFound => Ok(no_update()),
        error => Err(format!("Update check failed: {error}")),
    }
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateStatus, String> {
    check_for_updates_with(app).await
}

async fn check_for_updates_with<R: Runtime>(app: AppHandle<R>) -> Result<UpdateStatus, String> {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => return Err(format!("Updater initialization: {}", e)),
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            Ok(UpdateStatus {
                available: true,
                installed: false,
                restart_required: false,
                version: Some(version),
                current_version: update.current_version,
            })
        }
        Ok(None) => Ok(no_update()),
        Err(error) => check_error(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_release_is_no_update() {
        let status = check_error(tauri_plugin_updater::Error::ReleaseNotFound).unwrap();
        assert!(!status.available && !status.installed && !status.restart_required);
        assert!(status.version.is_none());
    }

    #[test]
    fn unrelated_errors_are_not_hidden_by_message_matching() {
        assert!(check_error(tauri_plugin_updater::Error::Network("404 not found".into())).is_err());
        assert!(check_error(tauri_plugin_updater::Error::TargetNotFound(
            "darwin-aarch64".into()
        ))
        .is_err());
    }
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<UpdateStatus, String> {
    install_update_with(app).await
}

async fn install_update_with<R: Runtime>(app: AppHandle<R>) -> Result<UpdateStatus, String> {
    let updater = app
        .updater()
        .map_err(|error| format!("Updater initialization: {error}"))?;
    let update = updater
        .check()
        .await
        .map_err(|error| format!("Update check failed: {error}"))?
        .ok_or_else(|| "No update is available".to_string())?;
    let version = update.version.clone();
    update
        .restart_after_install(false)
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| format!("Update installation failed: {error}"))?;
    Ok(UpdateStatus {
        available: true,
        installed: true,
        restart_required: true,
        version: Some(version),
        current_version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[cfg(test)]
#[path = "updater_contract_tests.rs"]
mod contract_tests;
