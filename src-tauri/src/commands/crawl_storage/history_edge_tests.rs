use super::history::{load_crawl_history_with_recovery, read_crawl_history_file};
use super::{decode_crawl_runs, STORAGE_MAGIC};
use flate2::{write::GzEncoder, Compression};
use serde_json::json;
use std::{fs, io::Write};

fn directory() -> std::path::PathBuf {
    let path = std::env::temp_dir().join(format!("seomi-history-edge-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn compressed_history_rejects_corrupt_gzip_payload() {
    let mut bytes = STORAGE_MAGIC.to_vec();
    bytes.extend_from_slice(b"not-gzip");
    assert!(decode_crawl_runs(&bytes)
        .unwrap_err()
        .contains("compressed crawl data is invalid"));
}

#[test]
fn compressed_history_rejects_valid_gzip_with_invalid_json() {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(b"not-json").unwrap();
    let mut bytes = STORAGE_MAGIC.to_vec();
    bytes.extend_from_slice(&encoder.finish().unwrap());
    assert!(decode_crawl_runs(&bytes)
        .unwrap_err()
        .contains("Saved crawl data is invalid"));
}

#[test]
fn history_reader_reports_a_directory_as_a_read_failure() {
    let directory = directory();
    let error = read_crawl_history_file(&directory).unwrap_err();
    assert!(error.contains("saved crawl runs"));
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn history_reader_keeps_json_arrays_as_the_storage_contract() {
    let directory = directory();
    let path = directory.join("history.json");
    fs::write(&path, serde_json::to_vec(&json!([])).unwrap()).unwrap();
    assert_eq!(read_crawl_history_file(&path).unwrap(), json!([]));
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn load_reports_the_primary_error_when_no_backup_exists() {
    let directory = directory();
    let path = directory.join("history.json");
    fs::write(&path, b"not-json").unwrap();

    let error = load_crawl_history_with_recovery(&path).unwrap_err();
    assert!(error.contains("Saved crawl data is invalid"));
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn load_keeps_the_primary_error_when_the_backup_is_invalid() {
    let directory = directory();
    let path = directory.join("history.json");
    fs::write(&path, STORAGE_MAGIC).unwrap();
    fs::write(path.with_extension("json.bak"), b"not-json").unwrap();

    let error = load_crawl_history_with_recovery(&path).unwrap_err();
    assert!(error.contains("Saved compressed crawl data is invalid"));
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn load_returns_recovered_data_when_replacing_a_directory_fails() {
    let directory = directory();
    let path = directory.join("history.json");
    let backup = path.with_extension("json.bak");
    fs::create_dir(&path).unwrap();
    fs::write(
        &backup,
        super::encode_crawl_runs(&json!([{ "id": "backup" }])).unwrap(),
    )
    .unwrap();

    let recovered = load_crawl_history_with_recovery(&path).unwrap();
    assert_eq!(recovered, json!([{ "id": "backup" }]));
    assert!(path.is_dir());
    assert!(backup.exists());
    fs::remove_dir_all(directory).unwrap();
}

#[cfg(unix)]
#[test]
fn recover_backup_reports_a_real_rename_permission_error() {
    use super::history::recover_backup;
    use std::os::unix::fs::PermissionsExt;

    let directory = directory();
    let path = directory.join("history.json");
    let backup = path.with_extension("json.bak");
    fs::write(&backup, b"backup").unwrap();
    fs::set_permissions(&directory, fs::Permissions::from_mode(0o555)).unwrap();
    let result = recover_backup(&path);
    fs::set_permissions(&directory, fs::Permissions::from_mode(0o755)).unwrap();

    let error = result.unwrap_err();
    assert!(error.contains("Unable to recover previous crawl history"));
    fs::remove_dir_all(directory).unwrap();
}
