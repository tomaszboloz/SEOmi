use super::*;

#[tokio::test]
async fn head_reports_observed_status_without_reading_or_following() {
    for status in [200, 204, 301, 302, 304, 404, 503] {
        let server = Server::new(vec![response(status, Some(b"/next#anchor"))]).await;
        let result = server.check().await;
        assert_eq!(result.url, server.url.as_str());
        assert_eq!(result.http_status, Some(status));
        assert!(result.response_time_ms.is_some());
        assert_eq!(result.request_error_kind, None);
        assert_eq!(
            result.redirect_url.as_deref(),
            Some(server.url.join("/next#anchor").unwrap().as_str())
        );
        assert!(chrono::DateTime::parse_from_rfc3339(&result.checked_at).is_ok());
        let requests = server.requests().await;
        assert_eq!(requests.len(), 1);
        assert!(requests[0].starts_with("HEAD /page?q=1 HTTP/1.1\r\n"));
        assert!(!requests[0].to_ascii_lowercase().contains("range:"));
    }
}

#[tokio::test]
async fn unsupported_head_falls_back_to_single_byte_get_with_owned_evidence() {
    for status in [405, 501] {
        let server =
            Server::new(vec![response(status, None), response(206, Some(b"?new=2"))]).await;
        let result = server.check().await;
        assert_eq!(result.url, server.url.as_str());
        assert_eq!(result.http_status, Some(206));
        assert_eq!(
            result.redirect_url.as_deref(),
            Some(server.url.join("?new=2").unwrap().as_str())
        );
        assert!(result.response_time_ms.is_some());
        assert_eq!(result.request_error_kind, None);
        let requests = server.requests().await;
        assert_eq!(requests.len(), 2);
        assert!(requests[0].starts_with("HEAD /page?q=1 HTTP/1.1\r\n"));
        assert!(requests[1].starts_with("GET /page?q=1 HTTP/1.1\r\n"));
        assert!(requests[1]
            .to_ascii_lowercase()
            .contains("range: bytes=0-0\r\n"));
    }
}

#[tokio::test]
async fn missing_non_text_and_unresolvable_location_do_not_invent_targets() {
    for location in [None, Some(&b"\xff"[..]), Some(&b"http://["[..])] {
        let server = Server::new(vec![response(302, location)]).await;
        let result = server.check().await;
        assert_eq!(result.http_status, Some(302));
        assert_eq!(result.redirect_url, None);
        assert_eq!(result.request_error_kind, None);
        assert_eq!(server.requests().await.len(), 1);
    }
}
