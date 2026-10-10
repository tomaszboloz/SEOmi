use super::{
    decode_crawl_runs, encode_crawl_runs, load_crawl_history_with_recovery,
    read_crawl_history_file, recover_backup, validate_storage_size, MAX_EXPANDED_BYTES,
    MAX_STORED_BYTES, STORAGE_MAGIC,
};
use serde_json::json;
use std::{fs, path::PathBuf};

fn fixture_dir() -> PathBuf {
    let path = std::env::temp_dir().join(format!("seomi-crawl-boundary-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn storage_quota_accepts_each_boundary_and_rejects_the_next_byte() {
    assert!(
        validate_storage_size(MAX_STORED_BYTES as u64 + STORAGE_MAGIC.len() as u64, true).is_ok()
    );
    assert!(validate_storage_size(MAX_EXPANDED_BYTES, false).is_ok());
    assert!(validate_storage_size(
        MAX_STORED_BYTES as u64 + STORAGE_MAGIC.len() as u64 + 1,
        true
    )
    .is_err());
    assert!(validate_storage_size(MAX_EXPANDED_BYTES + 1, false).is_err());
}

#[test]
fn decoder_keeps_legacy_json_and_compressed_json_contracts() {
    let value = json!([{ "id": "run-1", "pages": 2 }]);
    let encoded = encode_crawl_runs(&value).unwrap();
    assert_eq!(decode_crawl_runs(&encoded).unwrap(), value);
    assert_eq!(
        decode_crawl_runs(br##"[{"id":"legacy"}]"##).unwrap(),
        json!([{ "id": "legacy" }])
    );
}

#[test]
fn backup_is_promoted_when_the_primary_history_is_absent() {
    let directory = fixture_dir();
    let path = directory.join("history.json");
    let backup = path.with_extension("json.bak");
    fs::write(
        &backup,
        encode_crawl_runs(&json!([{ "id": "backup" }])).unwrap(),
    )
    .unwrap();

    recover_backup(&path).unwrap();
    assert_eq!(
        read_crawl_history_file(&path).unwrap(),
        json!([{ "id": "backup" }])
    );
    assert!(!backup.exists());
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn missing_history_returns_an_empty_array_without_creating_files() {
    let directory = fixture_dir();
    let path = directory.join("history.json");
    assert_eq!(load_crawl_history_with_recovery(&path).unwrap(), json!([]));
    assert!(!path.exists());
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn valid_backup_replaces_a_corrupt_primary_history() {
    let directory = fixture_dir();
    let path = directory.join("history.json");
    fs::write(&path, b"not-json").unwrap();
    fs::write(
        path.with_extension("json.bak"),
        encode_crawl_runs(&json!([{ "id": "recovered" }])).unwrap(),
    )
    .unwrap();

    assert_eq!(
        load_crawl_history_with_recovery(&path).unwrap(),
        json!([{ "id": "recovered" }])
    );
    assert_eq!(
        read_crawl_history_file(&path).unwrap(),
        json!([{ "id": "recovered" }])
    );
    fs::remove_dir_all(directory).unwrap();
}
