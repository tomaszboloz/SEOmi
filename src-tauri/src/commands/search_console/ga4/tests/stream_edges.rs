use super::super::{streams::stream_candidates, validation::site_scope};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;

async fn serve_once(status: u16, body: String) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        if let Ok((mut stream, _)) = listener.accept().await {
            let _ = super::http_fixture::read_request(&mut stream).await;
            let resp = format!(
                "HTTP/1.1 {status} OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(resp.as_bytes()).await.unwrap();
            stream.shutdown().await.unwrap();
        }
    });
    (addr, handle)
}

async fn serve_twice(
    first: &'static str,
    second: &'static str,
) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        for body in [first, second] {
            if let Ok((mut stream, _)) = listener.accept().await {
                let _ = super::http_fixture::read_request(&mut stream).await;
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                stream.write_all(resp.as_bytes()).await.unwrap();
                stream.shutdown().await.unwrap();
            }
        }
    });
    (addr, handle)
}

#[tokio::test]
async fn stream_candidates_error_response() {
    let (addr, handle) = serve_once(500, r#"{"error":"boom"}"#.into()).await;
    let client = super::http_fixture::test_client();
    let scope = site_scope("https://example.com").unwrap();
    let res = stream_candidates(&client, "tok", &addr, &scope).await;
    assert!(res.is_err());
    handle.await.unwrap();
}

#[tokio::test]
async fn stream_candidates_invalid_web_stream_uri() {
    let body = r#"{"dataStreams":[{"type":"WEB_DATA_STREAM","webStreamData":{"defaultUri":"ftp://example.com"}}]}"#;
    let (addr, handle) = serve_once(200, body.into()).await;
    let client = super::http_fixture::test_client();
    let scope = site_scope("https://example.com").unwrap();
    let res = stream_candidates(&client, "tok", &addr, &scope).await;
    assert!(res.is_err());
    handle.await.unwrap();
}

#[tokio::test]
async fn stream_candidates_pagination_loop_protection() {
    let page1 = r#"{"dataStreams":[{"type":"WEB_DATA_STREAM","webStreamData":{"defaultUri":"https://example.com"}}],"nextPageToken":"loop"}"#;
    let page2 = r#"{"dataStreams":[],"nextPageToken":"loop"}"#;
    let (addr, handle) = serve_twice(page1, page2).await;
    let client = super::http_fixture::test_client();
    let scope = site_scope("https://example.com").unwrap();
    let (streams, pages, truncated) = stream_candidates(&client, "tok", &addr, &scope)
        .await
        .unwrap();
    assert_eq!(pages, 2);
    assert!(truncated);
    assert_eq!(streams.len(), 1);
    handle.await.unwrap();
}

#[tokio::test]
async fn stream_candidates_invalid_pagination_token() {
    let long_token = "a".repeat(2049);
    let body = format!(r#"{{"dataStreams":[],"nextPageToken":"{long_token}"}}"#);
    let (addr, handle) = serve_once(200, body).await;
    let client = super::http_fixture::test_client();
    let scope = site_scope("https://example.com").unwrap();
    let res = stream_candidates(&client, "tok", &addr, &scope).await;
    assert!(res.is_err());
    handle.await.unwrap();
}
