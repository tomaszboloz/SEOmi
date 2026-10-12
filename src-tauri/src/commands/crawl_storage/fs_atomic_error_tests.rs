use super::{project_path, write_bytes_atomic, write_temporary_bytes};
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
