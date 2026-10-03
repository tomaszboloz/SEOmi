use super::encoding::{decode_crawl_runs, validate_storage_size, STORAGE_MAGIC};
use super::fs_atomic::replace_file;
use serde_json::Value;
use std::{fs, io::Read, path::Path};

pub(crate) fn recover_backup(path: &Path) -> Result<(), String> {
    let backup = path.with_extension("json.bak");
    if !path.exists() && backup.exists() {
        fs::rename(&backup, path)
            .map_err(|error| format!("Unable to recover previous crawl history: {error}"))?;
    }
    Ok(())
}

/// Read and validate one history file. Keeping this separate from the Tauri
/// command makes recovery deterministic and lets us try a previous atomic
/// snapshot when a power loss left the destination present but unreadable.
pub(crate) fn read_crawl_history_file(path: &Path) -> Result<Value, String> {
    let file_size = fs::metadata(path)
        .map_err(|error| format!("Unable to inspect saved crawl runs: {error}"))?
        .len();
    let mut header = [0u8; STORAGE_MAGIC.len()];
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Unable to open saved crawl runs: {error}"))?;
    let header_len = file
        .read(&mut header)
        .map_err(|error| format!("Unable to inspect saved crawl runs: {error}"))?;
    let compressed = header_len == STORAGE_MAGIC.len() && header == STORAGE_MAGIC;
    validate_storage_size(file_size, compressed)?;
    let bytes =
        fs::read(path).map_err(|error| format!("Unable to read saved crawl runs: {error}"))?;
    decode_crawl_runs(&bytes)
}

pub(crate) fn load_crawl_history_with_recovery(path: &Path) -> Result<Value, String> {
    recover_backup(path)?;
    if !path.exists() {
        return Ok(Value::Array(Vec::new()));
    }
    match read_crawl_history_file(path) {
        Ok(value) => Ok(value),
        Err(primary_error) => {
            let backup = path.with_extension("json.bak");
            if !backup.exists() {
                return Err(primary_error);
            }
            let recovered = match read_crawl_history_file(&backup) {
                Ok(value) => value,
                Err(_) => return Err(primary_error),
            };
            if replace_file(&backup, path).is_err() {
                crate::utils::logging::diagnostic(
                    crate::utils::logging::Diagnostic::CrawlBackupRestoreFailed,
                );
            }
            Ok(recovered)
        }
    }
}
