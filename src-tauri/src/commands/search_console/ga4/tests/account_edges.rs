use super::super::account::account_candidates;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;

async fn serve_once(status: u16, body: &'static str) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        if let Ok((mut stream, _)) = listener.accept().await {
            let resp = format!(
                "HTTP/1.1 {status} OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = stream.write_all(resp.as_bytes()).await;
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
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(resp.as_bytes()).await;
            }
        }
    });
    (addr, handle)
}

#[tokio::test]
async fn account_candidates_error_response() {
    let (addr, handle) = serve_once(500, "{\"error\": \"failed\"}").await;
    let client = reqwest::Client::new();
    let res = account_candidates(&client, "tok", &addr).await;
    assert!(res.is_err());
    handle.await.unwrap();
}

#[tokio::test]
async fn account_candidates_invalid_property_name() {
    let body = "{\"accountSummaries\":[{\"propertySummaries\":[{\"property\":\"invalid\"}]}]}";
    let (addr, handle) = serve_once(200, body).await;
    let client = reqwest::Client::new();
    let res = account_candidates(&client, "tok", &addr).await;
    assert!(res.is_err());
    handle.await.unwrap();
}

#[tokio::test]
async fn account_candidates_dedup_and_empty_display_name() {
    let body = r#"{"accountSummaries":[
        {"propertySummaries":[{"property":"properties/123","displayName":"  "}]},
        {"propertySummaries":[{"property":"properties/123","displayName":"Main"}]}
    ]}"#;
    let (addr, handle) = serve_once(200, body).await;
    let client = reqwest::Client::new();
    let (candidates, pages, truncated) = account_candidates(&client, "tok", &addr).await.unwrap();
    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].property, "properties/123");
    assert_eq!(candidates[0].display_name, None);
    assert_eq!(pages, 1);
    assert!(!truncated);
    handle.await.unwrap();
}

#[tokio::test]
async fn account_candidates_pagination_loop_protection() {
    let page1 = r#"{"accountSummaries":[{"propertySummaries":[{"property":"properties/1"}]}],"nextPageToken":"loop"}"#;
    let page2 = r#"{"accountSummaries":[{"propertySummaries":[{"property":"properties/2"}]}],"nextPageToken":"loop"}"#;
    let (addr, handle) = serve_twice(page1, page2).await;
    let client = reqwest::Client::new();
    let (candidates, pages, truncated) = account_candidates(&client, "tok", &addr).await.unwrap();
    assert_eq!(pages, 2);
    assert!(truncated);
    assert_eq!(candidates.len(), 2);
    handle.await.unwrap();
}

#[tokio::test]
async fn account_candidates_invalid_pagination_token() {
    let long_token = "a".repeat(2049);
    let body = format!(r#"{{"accountSummaries":[],"nextPageToken":"{long_token}"}}"#);
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let addr = format!("http://{}", listener.local_addr().unwrap());
    let handle = tokio::spawn(async move {
        if let Ok((mut stream, _)) = listener.accept().await {
            let resp = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = stream.write_all(resp.as_bytes()).await;
        }
    });
    let client = reqwest::Client::new();
    let res = account_candidates(&client, "tok", &addr).await;
    assert!(res.is_err());
    handle.await.unwrap();
}
