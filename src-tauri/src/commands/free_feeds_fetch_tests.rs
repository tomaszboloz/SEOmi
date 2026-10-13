use super::fetch_public_feed_from;

#[tokio::test]
async fn fetching_builds_the_client_and_reports_an_unreachable_feed_as_an_error() {
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
        .await
        .unwrap();
    let url = url::Url::parse(&format!("http://{}/feed", listener.local_addr().unwrap())).unwrap();
    drop(listener);
    let response = fetch_public_feed_from(url.clone()).await.unwrap();
    assert_eq!(response.status, "error");
    assert_eq!(response.source_url, url.to_string());
    assert!(response.body.is_none());
}
