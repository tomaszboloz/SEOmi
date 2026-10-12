use super::write_temporary_bytes;
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
