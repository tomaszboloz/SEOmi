use super::{network::client_for_url, request::check_with};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[tokio::test]
async fn failed_fallback_get_is_reported_without_invented_status() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = [0u8; 1024];
        let _ = stream.read(&mut request).await.unwrap();
        stream
            .write_all(
                b"HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            )
            .await
            .unwrap();
        stream.shutdown().await.unwrap();
    });
    let input = format!("http://seomi.test:{}/page", address.port());
    let result = check_with(
        input.clone(),
        move |_| async move { Ok(vec![address]) },
        client_for_url,
    )
    .await;
    server.await.unwrap();
    assert_eq!(result.url, input);
    assert_eq!(result.http_status, None);
    assert_eq!(result.response_time_ms, None);
    assert_eq!(result.redirect_url, None);
    assert!(matches!(
        result.request_error_kind.as_deref(),
        Some("connect" | "network" | "timeout")
    ));
}
