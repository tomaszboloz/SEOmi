use super::*;

#[tokio::test]
async fn missing_invalid_and_rejected_locations_do_not_contact_targets() {
    for (headers, expected) in [
        ("", "no valid Location"),
        ("Location: \u{0080}\r\n", "no valid Location"),
        ("Location: http://[\r\n", "cannot be resolved"),
        ("Location: http://localhost/secret\r\n", "rejected"),
        ("Location: http://127.0.0.1/secret\r\n", "rejected"),
        (
            "Location: https://user:password@example.test/secret\r\n",
            "rejected",
        ),
        ("Location: ftp://example.test/file\r\n", "rejected"),
        ("Location: https://other.test/page\r\n", "outside"),
        ("Location: /outside\r\n", "outside"),
    ] {
        let server = Server::new(vec![("/shop/start", 302, headers)]).await;
        let result = server.fetch("/shop/start", Some("/shop"), 10).await;
        assert!(result
            .redirect_stopped_reason
            .as_deref()
            .unwrap()
            .contains(expected));
        assert!(result.redirect_chain.is_empty());
        assert_eq!(result.final_url, format!("{}/shop/start", server.base));
        assert_eq!(status(result), 302);
        assert_eq!(*server.requests.lock().unwrap(), vec!["/shop/start"]);
    }
}

#[tokio::test]
async fn redirect_loops_and_zero_limit_preserve_attempted_hop_without_requesting_it() {
    let server = Server::new(vec![
        ("/start", 301, "Location: /next\r\n"),
        ("/next", 302, "Location: /start\r\n"),
    ])
    .await;
    let result = server.fetch("/start", None, 10).await;
    assert!(result
        .redirect_stopped_reason
        .as_deref()
        .unwrap()
        .contains("loop detected"));
    assert_eq!(result.redirect_chain.len(), 2);
    assert_eq!(result.final_url, format!("{}/next", server.base));
    assert_eq!(*server.requests.lock().unwrap(), vec!["/start", "/next"]);
    let server = Server::new(vec![("/start", 301, "Location: /next\r\n")]).await;
    let result = server.fetch("/start", None, 0).await;
    assert!(result
        .redirect_stopped_reason
        .as_deref()
        .unwrap()
        .contains("limit of 0 exceeded"));
    assert_eq!(result.redirect_chain.len(), 1);
    assert_eq!(result.final_url, format!("{}/start", server.base));
    assert_eq!(*server.requests.lock().unwrap(), vec!["/start"]);
}
