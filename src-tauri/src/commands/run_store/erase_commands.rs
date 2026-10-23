use tauri::AppHandle;

use super::commands::open_store;
use super::{erase, report};

#[tauri::command]
pub fn store_forget_subject<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
    subject_id: String,
) -> Result<report::ErasureReport, String> {
    erase::forget_subject(
        &mut open_store(&app, &project_id)?,
        &project_id,
        &subject_id,
    )
}

#[tauri::command]
pub fn store_erase_project<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<report::ErasureReport, String> {
    erase::erase_project(&mut open_store(&app, &project_id)?, &project_id)
}

#[tauri::command]
pub fn store_erasure_log<R: tauri::Runtime>(
    app: AppHandle<R>,
    project_id: String,
) -> Result<Vec<report::ErasureReport>, String> {
    report::audit_log(&open_store(&app, &project_id)?, &project_id)
}
