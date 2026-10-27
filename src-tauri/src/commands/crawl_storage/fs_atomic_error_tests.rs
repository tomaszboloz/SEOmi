use super::{create_temporary, project_path, write_bytes_atomic, write_temporary_bytes};
use std::io::{self, Write};

struct RejectingWriter;

impl Write for RejectingWriter {
    fn write(&mut self, _bytes: &[u8]) -> io::Result<usize> {
        Err(io::Error::other("fixture write failure"))
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[test]
fn temporary_writer_errors_are_returned_with_context() {
    let temporary =
        std::env::temp_dir().join(format!("seomi-write-error-{}", uuid::Uuid::new_v4()));
    let error = write_temporary_bytes(RejectingWriter, &temporary, b"payload").unwrap_err();
    assert!(error.contains("Unable to write temporary file: fixture write failure"));
}

#[test]
fn lock_failures_and_missing_data_folders_are_reported() {
    let missing = std::env::temp_dir()
        .join(format!("seomi-no-dir-{}", uuid::Uuid::new_v4()))
        .join("state.json");
    let error = write_bytes_atomic(&missing, b"{}").unwrap_err();
    assert!(error.starts_with("Unable to lock destination: "));
    let error = project_path("p", || Err(tauri::Error::UnknownPath)).unwrap_err();
    assert!(error.starts_with("Unable to locate application data folder: "));
    assert!(project_path("a/b", || Err(tauri::Error::UnknownPath))
        .unwrap_err()
        .contains("Invalid project identifier"));
}

#[test]
fn an_existing_temporary_file_is_never_overwritten() {
    let path = std::env::temp_dir().join(format!("seomi-temp-exists-{}", uuid::Uuid::new_v4()));
    std::fs::write(&path, b"keep").unwrap();
    let error = create_temporary(&path).unwrap_err();
    assert!(error.starts_with("Unable to create temporary file: "));
    assert_eq!(std::fs::read(&path).unwrap(), b"keep");
    std::fs::remove_file(path).unwrap();
}
