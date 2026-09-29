use serde::Serialize;
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Serialize)]
pub struct UpdateStatus {
    pub available: bool,
    pub installed: bool,
    pub restart_required: bool,
    pub version: Option<String>,
    pub current_version: String,
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateStatus, String> {
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
        Ok(None) => Ok(UpdateStatus {
            available: false,
            installed: false,
            restart_required: false,
            version: None,
            current_version: env!("CARGO_PKG_VERSION").to_string(),
        }),
        Err(e) => {
            let detail = e.to_string();
            // Source-only releases do not publish an updater manifest. Treat
            // a missing manifest as a clean "no update" state instead of
            // logging an error on every application start.
            if detail.contains("404") || detail.to_ascii_lowercase().contains("not found") {
                Ok(UpdateStatus {
                    available: false,
                    installed: false,
                    restart_required: false,
                    version: None,
                    current_version: env!("CARGO_PKG_VERSION").to_string(),
                })
            } else {
                Err(format!("Update check failed: {detail}"))
            }
        }
    }
}

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<UpdateStatus, String> {
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
