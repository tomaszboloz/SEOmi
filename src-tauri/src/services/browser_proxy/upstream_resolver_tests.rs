use super::upstream::{connect_to_public_host, reason_phrase};

#[test]
fn every_rejection_status_has_a_reason_phrase() {
    for (status, phrase) in [
        (400, "Bad Request"),
        (403, "Forbidden"),
        (405, "Method Not Allowed"),
        (408, "Request Timeout"),
        (413, "Payload Too Large"),
        (431, "Request Header Fields Too Large"),
        (502, "Bad Gateway"),
        (503, "Service Unavailable"),
        (418, "Error"),
    ] {
        assert_eq!(reason_phrase(status), phrase);
    }
}

#[tokio::test]
async fn default_resolver_failures_never_become_connections() {
    // The reserved `.invalid` TLD never resolves, so this exercises the system
    // resolver closure without any network dependency.
    let error = connect_to_public_host("seomi-test.invalid", 80)
        .await
        .unwrap_err();
    assert!(!error.to_string().is_empty());
}
