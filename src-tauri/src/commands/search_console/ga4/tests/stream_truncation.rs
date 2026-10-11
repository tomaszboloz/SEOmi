use super::super::{
    streams::stream_candidates,
    validation::{site_scope, MAX_PAGES},
};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;

#[tokio::test]
async fn stream_candidates_reports_truncation_at_the_page_limit() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        for page in 0..MAX_PAGES {
            let (mut stream, _) = listener.accept().await.unwrap();
            let _ = super::http_fixture::read_request(&mut stream).await;
            let body = format!(r#"{{"dataStreams":[],"nextPageToken":"page-{page}"}}"#);
            let head = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(head.as_bytes()).await.unwrap();
            stream.shutdown().await.unwrap();
        }
    });
    let client = super::http_fixture::test_client();
    let scope = site_scope("https://example.com").unwrap();
    let (streams, pages, truncated) = stream_candidates(&client, "tok", &addr, &scope)
        .await
        .unwrap();
    assert!(streams.is_empty());
    assert_eq!(pages, MAX_PAGES);
    assert!(truncated);
    handle.await.unwrap();
}
