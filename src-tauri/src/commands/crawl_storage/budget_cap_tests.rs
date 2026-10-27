use super::*;
use crate::utils::test_app::StorageApp;
use serde_json::json;
use tauri::test::mock_builder;

#[test]
fn crawl_runs_cap_rejects_more_than_fifty_runs() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();

    let mut runs = Vec::new();
    for i in 0..51 {
        runs.push(json!({"id": format!("run-{i}")}));
    }
    let err = save_project_crawl_runs(app.clone(), "proj-1".into(), json!(runs)).unwrap_err();
    assert_eq!(err, "A project can store at most 50 crawl runs.");

    runs.pop();
    assert_eq!(runs.len(), 50);
    assert!(save_project_crawl_runs(app, "proj-1".into(), json!(runs)).is_ok());
}

#[test]
fn checkpoint_safety_cap_rejects_oversized_payload() {
    let fixture = StorageApp::new(mock_builder());
    let app = fixture.handle();

    let huge_str = "x".repeat(MAX_CHECKPOINT_BYTES);
    let oversized = json!({"big": huge_str});
    let err = save_project_crawl_checkpoint(app, "proj-1".into(), oversized).unwrap_err();
    assert_eq!(err, "Crawl checkpoint exceeds the 32 MiB safety limit.");
}

#[test]
fn storage_size_quota_validation_enforces_bounds() {
    let compressed_limit = (MAX_STORED_BYTES + STORAGE_MAGIC.len()) as u64;
    assert!(validate_storage_size(compressed_limit, true).is_ok());
    assert_eq!(
        validate_storage_size(compressed_limit + 1, true).unwrap_err(),
        "Crawl history storage quota exceeded."
    );

    assert!(validate_storage_size(MAX_EXPANDED_BYTES, false).is_ok());
    assert_eq!(
        validate_storage_size(MAX_EXPANDED_BYTES + 1, false).unwrap_err(),
        "Crawl history storage quota exceeded."
    );
}

#[test]
fn atomic_write_cleans_up_temporary_file_on_error() {
    let temp_dir = std::env::temp_dir().join(format!("seomi-atomic-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let invalid_dest = temp_dir.join("nonexistent_subdir/file.json");

    let err = write_bytes_atomic(&invalid_dest, b"test payload").unwrap_err();
    assert!(err.contains("Unable to"));

    let _ = std::fs::remove_dir_all(&temp_dir);
}
