use super::*;

#[tokio::test]
async fn validation_and_resolver_and_builder_errors_short_circuit_requests() {
    let result = check_with(
        "http://localhost/a".into(),
        |_| async { panic!("must not resolve") },
        |_, _| panic!("must not build"),
    )
    .await;
    assert_rejection(&result, "http://localhost/a", "blocked");
    for (error, expected) in [
        ("DNS lookup failed: fixture", "dns"),
        ("DNS lookup timed out", "timeout"),
        ("private address", "blocked"),
    ] {
        let result = check_with(
            " seomi.test/a#fragment ".into(),
            |_| async move { Err(error.into()) },
            |_, _| panic!("must not build"),
        )
        .await;
        assert_rejection(&result, "https://seomi.test/a", expected);
    }
    let result = check_with(
        "https://seomi.test/a".into(),
        |_| async { Ok(vec![]) },
        |_, _| Err("fixture construction error".into()),
    )
    .await;
    assert_rejection(&result, "https://seomi.test/a", "network");
}

#[tokio::test]
async fn malformed_head_and_get_fail_without_invented_http_measurements() {
    for fallback in [false, true] {
        let mut responses = Vec::new();
        if fallback {
            responses.push(response(405, None));
        }
        responses.push(b"not an HTTP response\r\n\r\n".to_vec());
        let server = Server::new(responses).await;
        let result = server.check().await;
        assert_rejection(&result, server.url.as_str(), "network");
        assert_eq!(server.requests().await.len(), if fallback { 2 } else { 1 });
    }
}
