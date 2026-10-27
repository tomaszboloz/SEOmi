use super::protocol::read_protocol_line;
use std::io::{self, BufRead, Read};

struct FailingReader;

impl Read for FailingReader {
    fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
        Err(io::Error::other("broken pipe"))
    }
}

impl BufRead for FailingReader {
    fn fill_buf(&mut self) -> io::Result<&[u8]> {
        Err(io::Error::other("broken pipe"))
    }

    fn consume(&mut self, _: usize) {}
}

#[test]
fn protocol_read_failures_are_reported_without_leaking_io_details() {
    assert_eq!(
        read_protocol_line(&mut FailingReader, 8).unwrap_err(),
        "MCP protocol read failed."
    );
}
