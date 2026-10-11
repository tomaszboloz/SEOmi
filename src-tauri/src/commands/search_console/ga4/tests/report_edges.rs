use super::super::report::run_at;
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

#[tokio::test]
async fn run_at_input_validation_errors() {
    let client = reqwest::Client::new();
    let err = run_at(
        &client,
        "",
        "properties/123",
        "https://example.com",
        "example.com",
        "2026-01-01",
        "2026-01-02",
        "http://127.0.0.1",
    )
    .await
    .unwrap_err();
    assert_eq!(err, "Google Analytics access token is missing.");

    let err = run_at(
        &client,
        "tok",
        "invalid",
        "https://example.com",
        "example.com",
        "2026-01-01",
        "2026-01-02",
        "http://127.0.0.1",
    )
    .await
    .unwrap_err();
    assert_eq!(err, "Google Analytics returned an invalid property name.");

    let err = run_at(
        &client,
        "tok",
        "properties/123",
        "invalid-url",
        "example.com",
        "2026-01-01",
        "2026-01-02",
        "http://127.0.0.1",
    )
    .await
    .unwrap_err();
    assert_eq!(err, "Google Analytics site URL is invalid.");

    let err = run_at(
        &client,
        "tok",
        "properties/123",
        "https://example.com",
        "example.com",
        "2026-01-05",
        "2026-01-02",
        "http://127.0.0.1",
    )
    .await
    .unwrap_err();
    assert_eq!(err, "Google Analytics date range is invalid.");

    let err = run_at(
        &client,
        "tok",
        "properties/123",
        "https://example.com",
        "other.com",
        "2026-01-01",
        "2026-01-02",
        "http://127.0.0.1",
    )
    .await
    .unwrap_err();
    assert_eq!(
        err,
        "Google Analytics web stream is outside the selected site."
    );
}

#[tokio::test]
async fn run_at_server_error_and_invalid_json() {
    let (addr, handle) = serve_once(500, r#"{"error":"fail"}"#).await;
    let client = reqwest::Client::new();
    let res = run_at(
        &client,
        "tok",
        "properties/123",
        "https://example.com",
        "example.com",
        "2026-01-01",
        "2026-01-02",
        &addr,
    )
    .await;
    assert!(res.is_err());
    handle.await.unwrap();

    let (addr, handle) = serve_once(200, "not json").await;
    let res = run_at(
        &client,
        "tok",
        "properties/123",
        "https://example.com",
        "example.com",
        "2026-01-01",
        "2026-01-02",
        &addr,
    )
    .await;
    assert!(res.is_err());
    handle.await.unwrap();
}
