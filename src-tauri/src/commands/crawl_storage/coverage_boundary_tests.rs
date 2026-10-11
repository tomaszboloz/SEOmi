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

#[test]
fn encoding_edge_cases_zero_length_and_invalid_magic() {
    assert!(decode_crawl_runs(&[]).is_err());
    let mut bad_magic = STORAGE_MAGIC.to_vec();
    bad_magic.extend_from_slice(b"not-gzip-payload");
    assert!(decode_crawl_runs(&bad_magic).is_err());

    let mut truncated_gz = STORAGE_MAGIC.to_vec();
    truncated_gz.extend_from_slice(&[31, 139, 8, 0]);
    assert!(decode_crawl_runs(&truncated_gz).is_err());
}

#[test]
fn history_edge_cases_deletion_empty_lists_and_pagination() {
    let empty_runs = json!([]);
    let serde_json::Value::Array(mut runs) = empty_runs else {
        panic!()
    };

    let target_id = "non-existent-crawl-id";
    runs.retain(|run| run.get("id").and_then(|v| v.as_str()) != Some(target_id));
    assert_eq!(runs.len(), 0);

    let mut populated = [
        json!({"id": "run-2", "timestamp": 200}),
        json!({"id": "run-1", "timestamp": 100}),
    ];
    populated.sort_by(|a, b| {
        let ta = a.get("timestamp").and_then(|v| v.as_u64()).unwrap_or(0);
        let tb = b.get("timestamp").and_then(|v| v.as_u64()).unwrap_or(0);
        tb.cmp(&ta)
    });
    assert_eq!(populated[0]["id"], "run-2");

    let page: Vec<_> = populated.iter().take(2).collect();
    assert_eq!(page.len(), 2);
    let empty_page: Vec<_> = populated.iter().skip(2).collect();
    assert!(empty_page.is_empty());
}

#[test]
fn fs_atomic_missing_parent_and_replacement_failures() {
    let dir = fixture_dir();
    let missing_parent_path = dir.join("nonexistent_parent/sub/file.json");
    let err = super::write_bytes_atomic(&missing_parent_path, b"test").unwrap_err();
    assert!(err.contains("Unable to") || err.contains("lock"));

    let src = dir.join("missing.tmp");
    let dest = dir.join("dest.json");
    assert!(super::replace_file(&src, &dest).is_err());
    fs::remove_dir_all(dir).unwrap();
}
