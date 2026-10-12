use super::{
    protocol::{read_protocol_line, receive_response},
    MAX_PROTOCOL_LINES, MAX_PROTOCOL_LINE_BYTES,
};
use serde_json::json;
use std::{
    io::Cursor,
    sync::mpsc,
    time::{Duration, Instant},
};

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

#[test]
fn receive_response_skips_other_ids_and_returns_the_matching_result() {
    let (sender, receiver) = mpsc::channel();
    sender
        .send(Ok(br#"{"id":7,"result":{"ignored":true}}"#.to_vec()))
        .unwrap();
    sender
        .send(Ok(br#"{"id":9,"result":{"ok":true}}"#.to_vec()))
        .unwrap();
    let mut bytes = 0;
    let mut lines = 0;
    let result = receive_response(
        &receiver,
        9,
        Instant::now() + Duration::from_secs(1),
        &mut bytes,
        &mut lines,
    )
    .unwrap();
    assert_eq!(result, json!({"ok": true}));
    assert!(bytes > 0);
    assert_eq!(lines, 2);
}

#[test]
fn receive_response_reports_protocol_errors_and_missing_results() {
    for message in [
        br#"{"id":4,"error":{"message":"provider refused"}}"#.to_vec(),
        br#"{"id":4}"#.to_vec(),
        b"not-json".to_vec(),
    ] {
        let (sender, receiver) = mpsc::channel();
        sender.send(Ok(message)).unwrap();
        let mut bytes = 0;
        let mut lines = 0;
        let error = receive_response(
            &receiver,
            4,
            Instant::now() + Duration::from_secs(1),
            &mut bytes,
            &mut lines,
        )
        .unwrap_err();
        assert!(!error.is_empty());
    }
}

#[test]
fn receive_response_enforces_time_and_size_budgets() {
    let (_sender, receiver) = mpsc::channel::<Result<Vec<u8>, String>>();
    let mut bytes = 0;
    let mut lines = 0;
    assert_eq!(
        receive_response(&receiver, 1, Instant::now(), &mut bytes, &mut lines).unwrap_err(),
        "MCP server did not answer within the discovery timeout."
    );

    let (sender, receiver) = mpsc::channel();
    sender
        .send(Ok(vec![b'x'; MAX_PROTOCOL_LINE_BYTES + 1]))
        .unwrap();
    let error = receive_response(
        &receiver,
        1,
        Instant::now() + Duration::from_secs(1),
        &mut bytes,
        &mut lines,
    )
    .unwrap_err();
    assert!(error.contains("1 MiB"));
}

#[test]
fn receive_response_stops_after_protocol_line_limit() {
    let (sender, receiver) = mpsc::channel();
    for _ in 0..=MAX_PROTOCOL_LINES {
        sender
            .send(Ok(br#"{"id":0,"result":{}}"#.to_vec()))
            .unwrap();
    }
    let mut bytes = 0;
    let mut lines = 0;
    let error = receive_response(
        &receiver,
        1,
        Instant::now() + Duration::from_secs(1),
        &mut bytes,
        &mut lines,
    )
    .unwrap_err();
    assert!(error.contains("message limit"));
}
