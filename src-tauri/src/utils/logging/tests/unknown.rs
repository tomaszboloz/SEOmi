use super::*;

#[test]
fn unknown_commands_and_log_io_failures_cannot_leak_or_change_dispatch() {
    let mut records = Vec::new();
    assert!(dispatch_with_sink(
        "secret_token_https://user:pass@example.com",
        || true,
        |entry| {
            records.push(serde_json::to_value(entry).unwrap());
            Err(io::Error::other("sink failed"))
        }
    ));
    assert_eq!(records[0]["route"], "unknown");
    assert!(!serde_json::to_string(&records)
        .unwrap()
        .contains("secret_token"));
    assert!(dispatch("get_config", || true));
}
