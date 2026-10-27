use super::{network::client_for_url, request::check_with, request_flow::run};
use std::sync::{Arc, Mutex};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[tokio::test]
async fn redirect_without_location_header_returns_unverifiable() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut req = [0u8; 1024];
        let _ = stream.read(&mut req).await.unwrap();
        stream
            .write_all(
                b"HTTP/1.1 301 Moved Permanently\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            )
            .await
            .unwrap();
        stream.shutdown().await.unwrap();
    });
    let input = format!("http://seomi.test:{}/no-location", address.port());
    let result = check_with(
        input.clone(),
        move |_| async move { Ok(vec![address]) },
        client_for_url,
    )
    .await;
    server.await.unwrap();
    assert_eq!(result.http_status, Some(301));
    assert_eq!(result.request_error_kind.as_deref(), Some("unverifiable"));
}

#[tokio::test]
async fn client_build_error_and_dns_flow_direct_tests() {
    let state = Arc::new(Mutex::new(None));
    let result = run(
        "http://example.test/err".into(),
        |_| async { Ok(vec![]) },
        |_, _| Err("client creation failed".into()),
        None,
        state,
    )
    .await;
    assert_eq!(result.request_error_kind.as_deref(), Some("network"));
}
