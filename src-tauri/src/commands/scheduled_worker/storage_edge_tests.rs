use super::*;
use serde_json::json;
use std::path::Path;

#[test]
fn atomic_writer_reports_a_path_without_a_parent_directory() {
    let error = write_json_atomic(Path::new(""), &json!({}), 100)
        .expect_err("a relative file without a parent directory cannot be persisted");
    assert!(error.contains("no parent directory"));
}

#[test]
fn atomic_reader_rejects_garbage_json_without_falling_back_to_empty_data() {
    let directory =
        std::env::temp_dir().join(format!("seomi-scheduled-invalid-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    let path = directory.join("execution.json");
    fs::write(&path, br#"{"#).unwrap();

    let error = read_json::<Value>(&path, 100).unwrap_err();
    assert!(error.starts_with("Scheduled data is invalid:"));
    fs::remove_dir_all(directory).unwrap();
}
