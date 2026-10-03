use super::{protocol::receive_response, MAX_PROTOCOL_LINE_BYTES};
use serde_json::json;
use std::{
    sync::mpsc,
    time::{Duration, Instant},
};

#[test]
fn response_reader_preserves_results_and_skips_other_ids() {
    let (sender, receiver) = mpsc::channel();
    for value in [
        json!({"id":99,"result":null}),
        json!({"id":2,"result":{"tools":[]}}),
    ] {
        sender
            .send(Ok(serde_json::to_vec(&value).unwrap()))
            .unwrap();
    }
    let mut bytes = 0;
    let mut lines = 0;
    assert_eq!(
        receive_response(
            &receiver,
            2,
            Instant::now() + Duration::from_secs(1),
            &mut bytes,
            &mut lines
        )
        .unwrap(),
        json!({"tools":[]})
    );
    assert_eq!(lines, 2);
    assert!(bytes > 0);
}

#[test]
fn response_reader_rejects_malformed_errors_missing_results_and_worker_failures() {
    let cases = [
        (Ok(b"not-json".to_vec()), "non-JSON"),
        (Ok(br#"{"id":2}"#.to_vec()), "include a result"),
        (Ok(br#"{"id":2,"error":{}}"#.to_vec()), "request failed"),
        (
            Err("bounded producer failed".into()),
            "bounded producer failed",
        ),
    ];
    for (message, expected) in cases {
        let (sender, receiver) = mpsc::channel();
        sender.send(message).unwrap();
        assert!(receive_response(
            &receiver,
            2,
            Instant::now() + Duration::from_secs(1),
            &mut 0,
            &mut 0
        )
        .unwrap_err()
        .contains(expected));
    }
    let (sender, receiver) = mpsc::channel();
    sender
        .send(Ok(serde_json::to_vec(
            &json!({"id":2,"error":{"message":"ż".repeat(501)}}),
        )
        .unwrap()))
        .unwrap();
    assert_eq!(
        receive_response(
            &receiver,
            2,
            Instant::now() + Duration::from_secs(1),
            &mut 0,
            &mut 0
        )
        .unwrap_err(),
        "ż".repeat(500)
    );
}

#[test]
fn response_reader_retains_defensive_total_limits_and_deadlines() {
    for (mut bytes, mut lines, expected) in [
        (MAX_PROTOCOL_LINE_BYTES, 0, "1 MiB"),
        (0, 64, "message limit"),
    ] {
        let (sender, receiver) = mpsc::channel();
        sender.send(Ok(b"{}".to_vec())).unwrap();
        assert!(receive_response(
            &receiver,
            2,
            Instant::now() + Duration::from_secs(1),
            &mut bytes,
            &mut lines
        )
        .unwrap_err()
        .contains(expected));
    }
    let (_sender, receiver) = mpsc::channel();
    assert!(
        receive_response(&receiver, 2, Instant::now(), &mut 0, &mut 0)
            .unwrap_err()
            .contains("timeout")
    );
}
