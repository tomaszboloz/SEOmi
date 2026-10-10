use super::rows::performance_rows;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    time::Duration,
};

async fn connect_error_proxy() -> (String, tokio::task::JoinHandle<String>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        loop {
            let mut byte = [0u8];
            stream.read_exact(&mut byte).await.unwrap();
            request.push(byte[0]);
            if request.ends_with(b"\r\n\r\n") {
                break;
            }
        }
        stream
            .write_all(
                b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            )
            .await
            .unwrap();
        String::from_utf8(request).unwrap()
    });
    (endpoint, task)
}

#[tokio::test]
async fn wrapper_targets_google_through_controlled_proxy_error() {
    let (proxy, server) = connect_error_proxy().await;
    let client = reqwest::Client::builder()
        .proxy(reqwest::Proxy::all(&proxy).unwrap())
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap();
    let result = performance_rows(
        &client,
        "synthetic-token",
        "https://example.com/",
        "2026-09-01",
        "2026-09-28",
        Some("query"),
        &Default::default(),
    )
    .await;
    let error = match result {
        Ok(_) => panic!("controlled proxy should reject the request"),
        Err(error) => error,
    };
    let request = server.await.unwrap();
    assert!(request.starts_with("CONNECT searchconsole.googleapis.com:443 HTTP/1.1"));
    assert_eq!(error, "Google Search Console request failed.");
}
