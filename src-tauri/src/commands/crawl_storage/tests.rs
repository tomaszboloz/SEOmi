use super::encoding::{
    decode_crawl_runs, encode_crawl_runs, validate_storage_size, MAX_EXPANDED_BYTES,
    MAX_STORED_BYTES, STORAGE_MAGIC,
};
use super::fs_atomic::replace_file;
use super::history::{load_crawl_history_with_recovery, read_crawl_history_file};
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
        validate_storage_size((MAX_STORED_BYTES + STORAGE_MAGIC.len()) as u64 + 1, true).is_err()
    );
    assert!(validate_storage_size(MAX_EXPANDED_BYTES, false).is_ok());
    assert!(validate_storage_size((MAX_STORED_BYTES + STORAGE_MAGIC.len()) as u64, true).is_ok());
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

#[test]
fn reads_both_history_formats_from_disk_and_rejects_sparse_oversize_files() {
    use std::io::Write;
    let directory = std::env::temp_dir().join(format!("seomi-history-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    let path = directory.join("history.json");
    let expected = json!([{ "id": "żółć", "pages": [] }]);
    for bytes in [
        serde_json::to_vec(&expected).unwrap(),
        encode_crawl_runs(&expected).unwrap(),
    ] {
        fs::write(&path, bytes).unwrap();
        assert_eq!(read_crawl_history_file(&path).unwrap(), expected);
    }
    for (header, length) in [
        (&b"[]"[..], MAX_EXPANDED_BYTES + 1),
        (
            STORAGE_MAGIC,
            (MAX_STORED_BYTES + STORAGE_MAGIC.len()) as u64 + 1,
        ),
    ] {
        let mut file = fs::File::create(&path).unwrap();
        file.write_all(header).unwrap();
        file.set_len(length).unwrap();
        drop(file);
        assert_eq!(
            read_crawl_history_file(&path).unwrap_err(),
            "Crawl history storage quota exceeded."
        );
    }
    fs::write(&path, []).unwrap();
    assert!(read_crawl_history_file(&path).is_err());
    fs::remove_file(&path).unwrap();
    assert!(read_crawl_history_file(&path).is_err());
    fs::remove_dir_all(directory).unwrap();
}
