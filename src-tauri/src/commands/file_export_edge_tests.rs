use super::{validate_export_path, write_mcp_config_file};
use std::fs;
use std::path::PathBuf;

fn temp_directory() -> PathBuf {
    let directory =
        std::env::temp_dir().join(format!("seomi-mcp-export-edge-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&directory).unwrap();
    directory
}

#[test]
fn trims_full_paths_and_rejects_a_file_as_parent() {
    let directory = temp_directory();
    let destination = directory.join("trimmed.json");
    let padded = format!("  {}  ", destination.display());
    assert!(validate_export_path(&padded).is_ok());

    let parent_file = directory.join("parent.json");
    fs::write(&parent_file, "parent").unwrap();
    let nested = parent_file.join("child.json");
    let error = validate_export_path(nested.to_str().unwrap()).unwrap_err();
    assert!(error.contains("parent is not a directory"));
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn rejects_directory_destination_and_null_contents() {
    let directory = temp_directory();
    let destination = directory.join("destination.json");
    fs::create_dir(&destination).unwrap();
    let error =
        write_mcp_config_file(destination.to_string_lossy().into_owned(), "{}".into()).unwrap_err();
    assert!(error.contains("not a regular file"));

    let null_error = write_mcp_config_file(
        directory.join("null.json").to_string_lossy().into_owned(),
        "invalid\0json".into(),
    )
    .unwrap_err();
    assert!(null_error.contains("invalid null character"));
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn reports_deterministic_write_failure_for_an_unrepresentable_name() {
    let directory = temp_directory();
    let long_name = format!("{}.json", "x".repeat(4096));
    let destination = directory.join(long_name);
    let error =
        write_mcp_config_file(destination.to_string_lossy().into_owned(), "{}".into()).unwrap_err();
    assert!(error.contains("could not be written"));
    fs::remove_dir_all(directory).unwrap();
}

#[cfg(unix)]
#[test]
fn refuses_a_symbolic_link_without_touching_its_target() {
    use std::os::unix::fs::symlink;

    let directory = temp_directory();
    let target = directory.join("target.json");
    let link = directory.join("link.json");
    fs::write(&target, "original").unwrap();
    symlink(&target, &link).unwrap();
    let error =
        write_mcp_config_file(link.to_string_lossy().into_owned(), "changed".into()).unwrap_err();
    assert!(error.contains("symbolic link"));
    assert_eq!(fs::read_to_string(target).unwrap(), "original");
    fs::remove_dir_all(directory).unwrap();
}
