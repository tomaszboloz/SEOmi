use super::read_history_payload;
use std::io::{self, Read, Seek, SeekFrom};

struct SeekRejectingReader;

impl Read for SeekRejectingReader {
    fn read(&mut self, _bytes: &mut [u8]) -> io::Result<usize> {
        Ok(0)
    }
}

impl Seek for SeekRejectingReader {
    fn seek(&mut self, _position: SeekFrom) -> io::Result<u64> {
        Err(io::Error::other("fixture seek failure"))
    }
}

struct ReadRejectingReader;

impl Read for ReadRejectingReader {
    fn read(&mut self, _bytes: &mut [u8]) -> io::Result<usize> {
        Err(io::Error::other("fixture read failure"))
    }
}

impl Seek for ReadRejectingReader {
    fn seek(&mut self, _position: SeekFrom) -> io::Result<u64> {
        Ok(0)
    }
}

#[test]
fn payload_reader_preserves_seek_and_read_error_context() {
    let seek_error = read_history_payload(SeekRejectingReader, 0, false).unwrap_err();
    assert!(seek_error.contains("fixture seek failure"));

    let read_error = read_history_payload(ReadRejectingReader, 1, false).unwrap_err();
    assert!(read_error.contains("fixture read failure"));
}
