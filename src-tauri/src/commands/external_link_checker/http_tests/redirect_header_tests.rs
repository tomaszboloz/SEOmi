use super::*;

#[tokio::test]
async fn redirect_chain_follows_each_supported_3xx_status() {
    for status in [301, 302, 303, 307, 308] {
        let server = Server::new(vec![
            response(status, Some(b"/dest-path?ref=test")),
            response(200, None),
        ])
        .await;
        let result = server.check().await;
        assert_eq!(result.url, server.url.as_str());
        assert_eq!(result.http_status, Some(200));
        assert!(result.request_error_kind.is_none());
        assert_eq!(
            result.redirect_url.as_deref(),
            Some(server.url.join("/dest-path?ref=test").unwrap().as_str())
        );
        let requests = server.requests().await;
        assert_eq!(
            requests.len(),
            2,
            "redirect chain should reach the final target"
        );
    }
}

#[tokio::test]
async fn header_extraction_supports_absolute_and_protocol_relative_targets() {
    let server = Server::new(vec![
        response(301, Some(b"http://another-site.test/landing")),
        response(200, None),
    ])
    .await;
    let result = server.check().await;
    assert_eq!(result.http_status, Some(200));
    assert_eq!(
        result.redirect_url.as_deref(),
        Some("http://another-site.test/landing")
    );
    assert_eq!(server.requests().await.len(), 2);

    let server_proto = Server::new(vec![
        response(302, Some(b"//cdn.test/assets/file.pdf")),
        response(200, None),
    ])
    .await;
    let result_proto = server_proto.check().await;
    assert_eq!(result_proto.http_status, Some(200));
    assert_eq!(
        result_proto.redirect_url.as_deref(),
        Some("http://cdn.test/assets/file.pdf")
    );
    assert_eq!(server_proto.requests().await.len(), 2);
}

#[tokio::test]
async fn header_extraction_handles_empty_relative_and_unresolvable_locations() {
    let server_empty = Server::new(vec![response(302, Some(b""))]).await;
    let result_empty = server_empty.check().await;
    assert_eq!(result_empty.http_status, Some(302));
    assert_eq!(
        result_empty.redirect_url.as_deref(),
        Some(server_empty.url.as_str())
    );
    assert_eq!(
        result_empty.request_error_kind.as_deref(),
        Some("unverifiable")
    );

    let server_bad = Server::new(vec![response(302, Some(b"http://[::invalid"))]).await;
    let result_bad = server_bad.check().await;
    assert_eq!(result_bad.http_status, Some(302));
    assert_eq!(result_bad.redirect_url, None);
    assert_eq!(
        result_bad.request_error_kind.as_deref(),
        Some("unverifiable")
    );

    let server_non_utf8 = Server::new(vec![response(302, Some(&[0xff, 0xfe, 0xfd]))]).await;
    let result_non_utf8 = server_non_utf8.check().await;
    assert_eq!(result_non_utf8.http_status, Some(302));
    assert_eq!(result_non_utf8.redirect_url, None);
    assert_eq!(
        result_non_utf8.request_error_kind.as_deref(),
        Some("unverifiable")
    );
}
