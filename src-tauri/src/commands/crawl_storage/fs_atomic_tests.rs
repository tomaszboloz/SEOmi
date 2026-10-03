use super::*;

fn directory() -> PathBuf {
    let path = std::env::temp_dir().join(format!("seomi-atomic-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&path).unwrap();
    path
}

#[test]
fn unique_atomic_bytes_replace_destination_without_touching_legacy_temporary() {
    let directory = directory();
    let destination = directory.join("data.json");
    let legacy_temporary = destination.with_extension("json.tmp");
    std::fs::write(&legacy_temporary, b"other writer").unwrap();
    write_bytes_atomic(&destination, b"first").unwrap();
    write_bytes_atomic(&destination, b"second").unwrap();
    assert_eq!(std::fs::read(&destination).unwrap(), b"second");
    assert_eq!(std::fs::read(&legacy_temporary).unwrap(), b"other writer");
    assert!(destination.with_extension("json.write.lock").is_file());
    assert_eq!(std::fs::read_dir(&directory).unwrap().count(), 3);
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn atomic_creation_and_finalization_errors_preserve_destination_and_remove_owned_files() {
    let directory = directory();
    let missing_parent = directory.join("missing/data.json");
    assert!(write_bytes_atomic(&missing_parent, b"data")
        .unwrap_err()
        .contains("lock destination"));
    assert!(!missing_parent.exists());
    let destination = directory.join("data.json");
    std::fs::create_dir(&destination).unwrap();
    assert!(write_bytes_atomic(&destination, b"data")
        .unwrap_err()
        .contains("finalize file"));
    assert!(destination.is_dir());
    assert!(destination.with_extension("json.write.lock").is_file());
    assert_eq!(std::fs::read_dir(&directory).unwrap().count(), 2);
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
fn bounded_reader_distinguishes_exact_empty_missing_and_oversized_files() {
    let directory = directory();
    let path = directory.join("data.json");
    assert_eq!(
        read_bytes_bounded(&path, 10).unwrap_err().kind(),
        io::ErrorKind::NotFound
    );
    std::fs::write(&path, b"").unwrap();
    assert!(read_bytes_bounded(&path, 0).unwrap().is_empty());
    std::fs::write(&path, b"1234").unwrap();
    assert_eq!(read_bytes_bounded(&path, 4).unwrap(), b"1234");
    for budget in [0, 3] {
        let error = read_bytes_bounded(&path, budget).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("safety limit"));
    }
    assert_eq!(std::fs::read(&path).unwrap(), b"1234");
    std::fs::remove_dir_all(directory).unwrap();
}
