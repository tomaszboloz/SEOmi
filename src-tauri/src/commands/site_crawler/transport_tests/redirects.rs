use super::*;

#[tokio::test]
async fn non_redirect_statuses_do_not_follow_location_headers() {
    for code in [200, 300, 304, 305, 306, 399, 404, 503] {
        let server = Server::new(vec![
            ("/start", code, "Location: /next\r\n"),
            ("/next", 200, ""),
        ])
        .await;
        let result = server.fetch("/start", None, 10).await;
        assert_eq!(result.final_url, format!("{}/start", server.base));
        assert!(result.redirect_chain.is_empty());
        assert_eq!(result.redirect_stopped_reason, None);
        assert_eq!(status(result), code);
        assert_eq!(*server.requests.lock().unwrap(), vec!["/start"]);
    }
}

#[tokio::test]
async fn supported_redirect_statuses_follow_relative_locations_and_keep_hops() {
    for code in [301, 302, 303, 307, 308] {
        let server = Server::new(vec![
            (
                "/start",
                code,
                "Location: /next?utm_source=fixture#fragment\r\n",
            ),
            ("/next", 200, ""),
        ])
        .await;
        let result = server.fetch("/start", None, 1).await;
        assert_eq!(result.final_url, format!("{}/next", server.base));
        assert_eq!(result.redirect_stopped_reason, None);
        assert_eq!(result.redirect_chain.len(), 1);
        let hop = &result.redirect_chain[0];
        assert_eq!(hop.from_url, format!("{}/start", server.base));
        assert_eq!(hop.to_url, result.final_url);
        assert_eq!(hop.http_status, code);
        assert!(hop.response_time_ms.is_some());
        assert_eq!(status(result), 200);
        assert_eq!(*server.requests.lock().unwrap(), vec!["/start", "/next"]);
    }
}
