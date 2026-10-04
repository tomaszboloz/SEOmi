use super::*;

#[tokio::test]
async fn truncated_image_transfer_preserves_http_but_discards_partial_dimensions() {
    let result = fetch(
        200,
        b"Content-Type: image/png\r\nContent-Length: 25\r\n",
        png(),
        "image",
    )
    .await;
    assert_eq!(result.http_status, Some(200));
    assert_eq!(result.content_length, Some(25));
    assert_eq!(result.content_type.as_deref(), Some("image/png"));
    assert_eq!(
        result.request_error_kind.as_deref(),
        Some("resource_body_read")
    );
    assert_unknown_dimensions(&result);
}

#[tokio::test]
async fn timeout_preserves_candidate_and_does_not_invent_http_evidence() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}/asset", listener.local_addr().unwrap());
    let (accepted, observed) = tokio::sync::oneshot::channel();
    let server = tokio::spawn(async move {
        let (_socket, _) = listener.accept().await.unwrap();
        accepted.send(()).unwrap();
        std::future::pending::<()>().await;
    });
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_millis(100))
        .build()
        .unwrap();
    let result = fetch_resource_candidate(
        client,
        ResourceCandidate {
            url: endpoint.clone(),
            resource_type: "image".into(),
            source_urls: vec!["https://example.test/page".into()],
        },
    )
    .await;
    observed.await.unwrap();
    server.abort();
    assert!(server.await.unwrap_err().is_cancelled());
    assert_eq!(result.url, endpoint);
    assert_eq!(result.resource_type, "image");
    assert_eq!(result.source_urls, vec!["https://example.test/page"]);
    assert_eq!(result.http_status, None);
    assert_eq!(result.content_type, None);
    assert_eq!(result.content_length, None);
    assert_eq!(result.request_error_kind.as_deref(), Some("timeout"));
    assert!(result.response_time_ms.is_some());
    assert_unknown_dimensions(&result);
}
