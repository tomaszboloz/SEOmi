use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use serde_json::Value;
use std::{
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

const STORAGE_MAGIC: &[u8] = b"SEOMI-CRAWL-GZIP-V1\n";
const MAX_STORED_BYTES: usize = 512 * 1024 * 1024;
const MAX_EXPANDED_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_CHECKPOINT_BYTES: usize = 32 * 1024 * 1024;

fn validate_storage_size(stored_len: u64, compressed: bool) -> Result<(), String> {
    let limit = if compressed {
        (MAX_STORED_BYTES + STORAGE_MAGIC.len()) as u64
    } else {
        MAX_EXPANDED_BYTES
    };
    if stored_len > limit {
        // The frontend maps this stable quota marker to the active locale and
        // platform-specific recovery guidance.
        return Err("Crawl history storage quota exceeded.".into());
    }
    Ok(())
}

fn encode_crawl_runs(crawl_runs: &Value) -> Result<Vec<u8>, String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    serde_json::to_writer(&mut encoder, crawl_runs)
        .map_err(|error| format!("Unable to serialize crawl runs: {error}"))?;
    let compressed = encoder
        .finish()
        .map_err(|error| format!("Unable to compress crawl history: {error}"))?;
    if compressed.len() > MAX_STORED_BYTES {
        return Err("Skrośna historia crawla nadal przekracza limit 512 MiB po kompresji. Zmniejsz limit stron lub usuń starsze runy.".into());
    }
    let mut bytes = Vec::with_capacity(STORAGE_MAGIC.len() + compressed.len());
    bytes.extend_from_slice(STORAGE_MAGIC);
    bytes.extend_from_slice(&compressed);
    Ok(bytes)
}

fn decode_crawl_runs(bytes: &[u8]) -> Result<Value, String> {
    if let Some(compressed) = bytes.strip_prefix(STORAGE_MAGIC) {
        validate_storage_size(bytes.len() as u64, true)?;
        let decoder = GzDecoder::new(compressed);
        let mut expanded = Vec::new();
        decoder
            .take(MAX_EXPANDED_BYTES + 1)
            .read_to_end(&mut expanded)
            .map_err(|error| format!("Saved compressed crawl data is invalid: {error}"))?;
        if expanded.len() as u64 > MAX_EXPANDED_BYTES {
            return Err("Crawl history storage quota exceeded.".into());
        }
        return serde_json::from_slice(&expanded)
            .map_err(|error| format!("Saved crawl data is invalid: {error}"));
    }
    // Read histories produced by earlier releases before compressed storage.
    validate_storage_size(bytes.len() as u64, false)?;
    serde_json::from_slice(bytes).map_err(|error| format!("Saved crawl data is invalid: {error}"))
}

#[cfg(windows)]
pub(crate) fn replace_file(
    source: &std::path::Path,
    destination: &std::path::Path,
) -> io::Result<()> {
    use std::{iter, os::windows::ffi::OsStrExt};
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source_wide: Vec<u16> = source
        .as_os_str()
        .encode_wide()
        .chain(iter::once(0))
        .collect();
    let destination_wide: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(iter::once(0))
        .collect();
    let replaced = unsafe {
        MoveFileExW(
            source_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if replaced == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
pub(crate) fn replace_file(
    source: &std::path::Path,
    destination: &std::path::Path,
) -> io::Result<()> {
    fs::rename(source, destination)
}

pub(crate) fn project_directory(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    if project_id.is_empty()
        || project_id.len() > 80
        || !project_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("Invalid project identifier for crawl storage.".into());
    }
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to locate application data folder: {error}"))?
        .join("projects")
        .join(project_id))
}

fn recover_backup(path: &Path) -> Result<(), String> {
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
fn read_crawl_history_file(path: &Path) -> Result<Value, String> {
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

fn load_crawl_history_with_recovery(path: &Path) -> Result<Value, String> {
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
            // The recovered value is valid even if cleanup cannot replace the
            // damaged destination (for example, a transient filesystem lock).
            // The warning is intentionally non-fatal so the user can inspect
            // and re-save the history instead of losing access to it.
            if replace_file(&backup, path).is_err() {
                crate::utils::logging::diagnostic(
                    crate::utils::logging::Diagnostic::CrawlBackupRestoreFailed,
                );
            }
            Ok(recovered)
        }
    }
}

#[tauri::command]
pub fn load_project_crawl_runs(app: AppHandle, project_id: String) -> Result<Value, String> {
    let path = project_directory(&app, &project_id)?.join("crawl_runs.json");
    load_crawl_history_with_recovery(&path)
}

#[tauri::command]
pub fn save_project_crawl_runs(
    app: AppHandle,
    project_id: String,
    crawl_runs: Value,
) -> Result<(), String> {
    let Value::Array(runs) = &crawl_runs else {
        return Err("Crawl run storage expects a JSON array.".into());
    };
    if runs.len() > 50 {
        return Err("A project can store at most 50 crawl runs.".into());
    }
    let directory = project_directory(&app, &project_id)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Unable to create project crawl folder: {error}"))?;
    let destination = directory.join("crawl_runs.json");
    let temporary = directory.join("crawl_runs.json.tmp");
    let bytes = encode_crawl_runs(&crawl_runs)?;
    if let Err(error) = fs::write(&temporary, bytes) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Unable to write saved crawl runs: {error}"));
    }
    if let Err(error) = replace_file(&temporary, &destination) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Unable to finalize saved crawl runs: {error}"));
    }
    // Older versions kept a full-size backup beside every history file. Remove
    // any leftover copy after the new atomic replacement has safely completed.
    let backup = directory.join("crawl_runs.json.bak");
    if backup.exists() && fs::remove_file(&backup).is_err() {
        // The atomic replacement already committed the new history. A
        // stale recovery copy can consume disk space, but must not make a
        // successful save look failed and trigger a misleading retry.
        crate::utils::logging::diagnostic(
            crate::utils::logging::Diagnostic::CrawlBackupCleanupFailed,
        );
    }
    Ok(())
}

/// Load the small, project-scoped descriptor used to resume a crawl after a
/// desktop restart. It is deliberately stored separately from crawl history:
/// a checkpoint may exist while a crawl is still running and must not require
/// a completed run snapshot first.
#[tauri::command]
pub fn load_project_crawl_checkpoint(app: AppHandle, project_id: String) -> Result<Value, String> {
    let path = project_directory(&app, &project_id)?.join("crawl_checkpoint.json");
    if !path.exists() {
        return Ok(Value::Null);
    }
    let bytes = fs::read(path)
        .map_err(|error| format!("Unable to read saved crawl checkpoint: {error}"))?;
    if bytes.len() > MAX_CHECKPOINT_BYTES {
        return Err("Saved crawl checkpoint exceeds the 32 MiB safety limit.".into());
    }
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Saved crawl checkpoint is invalid: {error}"))
}

/// Atomically persist a bounded project-scoped crawl checkpoint. The command
/// accepts an object so malformed values cannot replace a valid checkpoint.
#[tauri::command]
pub fn save_project_crawl_checkpoint(
    app: AppHandle,
    project_id: String,
    checkpoint: Value,
) -> Result<(), String> {
    if !checkpoint.is_object() {
        return Err("Crawl checkpoint storage expects a JSON object.".into());
    }
    let bytes = serde_json::to_vec(&checkpoint)
        .map_err(|error| format!("Unable to serialize crawl checkpoint: {error}"))?;
    if bytes.len() > MAX_CHECKPOINT_BYTES {
        return Err("Crawl checkpoint exceeds the 32 MiB safety limit.".into());
    }
    let directory = project_directory(&app, &project_id)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Unable to create project crawl folder: {error}"))?;
    let destination = directory.join("crawl_checkpoint.json");
    let temporary = directory.join("crawl_checkpoint.json.tmp");
    if let Err(error) = fs::write(&temporary, bytes) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Unable to write crawl checkpoint: {error}"));
    }
    if let Err(error) = replace_file(&temporary, &destination) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Unable to finalize crawl checkpoint: {error}"));
    }
    Ok(())
}

#[tauri::command]
pub fn delete_project_crawl_checkpoint(app: AppHandle, project_id: String) -> Result<(), String> {
    let path = project_directory(&app, &project_id)?.join("crawl_checkpoint.json");
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Unable to delete crawl checkpoint: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        decode_crawl_runs, encode_crawl_runs, load_crawl_history_with_recovery,
        read_crawl_history_file, replace_file, validate_storage_size, MAX_EXPANDED_BYTES,
        MAX_STORED_BYTES, STORAGE_MAGIC,
    };
    use serde_json::json;
    use std::{fs, path::PathBuf};

    #[test]
    fn compresses_crawl_history_and_reads_the_compressed_snapshot() {
        let runs = json!([{
            "id": "run-1",
            "pages": (0..500).map(|index| json!({
                "url": format!("https://example.test/{index}"),
                "title": "Repeated crawl title",
                "links": (0..20).map(|_| json!({ "anchor": "Repeated internal link" })).collect::<Vec<_>>(),
            })).collect::<Vec<_>>(),
        }]);
        let raw = serde_json::to_vec(&runs).expect("fixture should serialize");
        let stored = encode_crawl_runs(&runs).expect("history should compress");

        assert!(stored.starts_with(STORAGE_MAGIC));
        assert!(stored.len() < raw.len() / 5);
        assert_eq!(
            decode_crawl_runs(&stored).expect("compressed history should load"),
            runs
        );
    }

    #[test]
    fn reads_legacy_uncompressed_crawl_history() {
        let runs = json!([{ "id": "legacy-run" }]);
        let raw = serde_json::to_vec(&runs).expect("fixture should serialize");

        assert_eq!(
            decode_crawl_runs(&raw).expect("legacy history should load"),
            runs
        );
    }

    #[test]
    fn rejects_histories_over_storage_limits_before_decoding() {
        assert!(validate_storage_size(MAX_EXPANDED_BYTES + 1, false).is_err());
        assert!(
            validate_storage_size((MAX_STORED_BYTES + STORAGE_MAGIC.len()) as u64 + 1, true)
                .is_err()
        );
        assert!(validate_storage_size(MAX_EXPANDED_BYTES, false).is_ok());
        assert!(
            validate_storage_size((MAX_STORED_BYTES + STORAGE_MAGIC.len()) as u64, true).is_ok()
        );
    }

    #[test]
    fn replaces_existing_history_without_a_second_full_size_backup() {
        let directory =
            std::env::temp_dir().join(format!("seomi-crawl-storage-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&directory).expect("temporary test directory should be created");
        let destination: PathBuf = directory.join("crawl_runs.json");
        let temporary = directory.join("crawl_runs.json.tmp");
        fs::write(&destination, b"old history").expect("old history should be written");
        fs::write(&temporary, b"new history").expect("new history should be written");

        replace_file(&temporary, &destination).expect("new history should replace the old file");

        assert_eq!(
            fs::read(&destination).expect("destination should exist"),
            b"new history"
        );
        assert!(!temporary.exists());
        assert!(!directory.join("crawl_runs.json.bak").exists());
        fs::remove_dir_all(directory).expect("temporary test directory should be removed");
    }

    #[test]
    fn recovers_a_valid_backup_when_the_primary_history_is_corrupt() {
        let directory =
            std::env::temp_dir().join(format!("seomi-crawl-recovery-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&directory).expect("temporary test directory should be created");
        let destination = directory.join("crawl_runs.json");
        let backup = directory.join("crawl_runs.json.bak");
        let expected = json!([{ "id": "recovered-run" }]);

        fs::write(&destination, b"truncated history").expect("corrupt history should be written");
        fs::write(
            &backup,
            encode_crawl_runs(&expected).expect("backup should be encoded"),
        )
        .expect("backup should be written");

        let recovered = load_crawl_history_with_recovery(&destination)
            .expect("valid backup should replace corrupt primary");
        assert_eq!(recovered, expected);
        assert_eq!(
            read_crawl_history_file(&destination).expect("recovered history should load"),
            expected
        );
        assert!(!backup.exists());
        fs::remove_dir_all(directory).expect("temporary test directory should be removed");
    }
}
