use super::protocol::read_protocol_line;
use std::io::Cursor;

#[test]
fn protocol_overflow_stops_reading_after_the_first_excess_byte() {
    let mut reader = Cursor::new(vec![b'x'; 4096]);
    let error = read_protocol_line(&mut reader, 128).unwrap_err();
    assert!(error.contains("1 MiB"));
    assert_eq!(reader.position(), 129);
}

#[test]
fn exact_remaining_budget_is_accepted_without_truncation() {
    let mut reader = Cursor::new(vec![b'x'; 128]);
    assert_eq!(
        read_protocol_line(&mut reader, 128).unwrap(),
        Some(vec![b'x'; 128])
    );
    assert_eq!(read_protocol_line(&mut reader, 0).unwrap(), None);
}

#[test]
fn newline_delimits_messages_without_consuming_the_next_line() {
    let mut reader = Cursor::new(b"first\nsecond\n".to_vec());
    assert_eq!(
        read_protocol_line(&mut reader, 12).unwrap(),
        Some(b"first\n".to_vec())
    );
    assert_eq!(reader.position(), 6);
    assert_eq!(
        read_protocol_line(&mut reader, 7).unwrap(),
        Some(b"second\n".to_vec())
    );
}
