use super::{entry_path, name_matches, remove_handoff_files};
use std::{fs, io, path::Path};

fn temp_dir() -> std::path::PathBuf {
    let directory =
        std::env::temp_dir().join(format!("seomi-cleanup-helpers-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&directory).unwrap();
    directory
}

#[test]
fn entry_path_forwards_paths_and_prefixes_io_errors() {
    let directory = temp_dir();
    fs::write(directory.join("a.json"), b"{}").unwrap();
    let entry = fs::read_dir(&directory).unwrap().next().unwrap();
    assert_eq!(
        entry_path(entry, "context").unwrap(),
        directory.join("a.json")
    );
    let failure = Err(io::Error::other("denied"));
    assert_eq!(
        entry_path(failure, "Unable to read").unwrap_err(),
        "Unable to read: denied"
    );
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn name_matches_requires_a_utf8_final_component() {
    assert!(name_matches(Path::new("dir/keep.json"), |name| name == "keep.json"));
    assert!(!name_matches(Path::new("dir/keep.json"), |name| name == "other"));
    assert!(!name_matches(Path::new(".."), |_| true));
}

#[test]
fn remove_handoff_files_handles_missing_unreadable_and_mixed_directories() {
    let directory = temp_dir();
    assert!(remove_handoff_files(&directory.join("missing")).is_ok());

    let not_a_directory = directory.join("file.txt");
    fs::write(&not_a_directory, b"x").unwrap();
    let error = remove_handoff_files(&not_a_directory).unwrap_err();
    assert!(error.starts_with("Unable to inspect audit queue files: "));

    fs::write(directory.join("audit_queue_result_run_item.json"), b"{}").unwrap();
    fs::write(directory.join("audit_queue.json"), b"{}").unwrap();
    remove_handoff_files(&directory).unwrap();
    assert!(!directory.join("audit_queue_result_run_item.json").exists());
    assert!(directory.join("audit_queue.json").exists());
    fs::remove_dir_all(directory).unwrap();
}
