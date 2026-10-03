use super::callback_io::{read_callback_request, write_callback_response};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::Duration,
};

async fn pair() -> (TcpStream, TcpStream) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let client = TcpStream::connect(listener.local_addr().unwrap())
        .await
        .unwrap();
    let (server, _) = listener.accept().await.unwrap();
    (client, server)
}

#[tokio::test]
async fn accepts_exact_limit_and_discards_body_bytes() {
    for size in [32, 16 * 1024] {
        let (mut client, mut server) = pair().await;
        let headers = format!("{}\r\n\r\n", "x".repeat(size - 4));
        let expected = headers.clone();
        let writer = tokio::spawn(async move {
            client
                .write_all(format!("{headers}body").as_bytes())
                .await
                .unwrap();
        });
        assert_eq!(
            read_callback_request(&mut server, Duration::from_secs(1))
                .await
                .unwrap(),
            expected
        );
        writer.await.unwrap();
    }
}

#[tokio::test]
async fn rejects_oversized_headers_with_or_without_a_terminator() {
    for terminated in [false, true] {
        let (mut client, mut server) = pair().await;
        let mut bytes = vec![b'x'; 16 * 1024 + 1];
        if terminated {
            bytes.extend_from_slice(b"\r\n\r\n");
        }
        let writer = tokio::spawn(async move {
            client.write_all(&bytes).await.unwrap();
        });
        assert!(read_callback_request(&mut server, Duration::from_secs(1))
            .await
            .unwrap_err()
            .contains("limit"));
        writer.await.unwrap();
    }
}

#[tokio::test]
async fn rejects_incomplete_and_invalid_utf8_requests() {
    for (bytes, expected) in [
        (b"GET /".as_slice(), "Incomplete"),
        (b"\xff\r\n\r\n".as_slice(), "encoding"),
    ] {
        let (mut client, mut server) = pair().await;
        client.write_all(bytes).await.unwrap();
        client.shutdown().await.unwrap();
        assert!(read_callback_request(&mut server, Duration::from_secs(1))
            .await
            .unwrap_err()
            .contains(expected));
    }
}

#[tokio::test]
async fn stalled_client_has_a_fixed_deadline() {
    let (_client, mut server) = pair().await;
    assert_eq!(
        read_callback_request(&mut server, Duration::from_millis(10))
            .await
            .unwrap_err(),
        "OAuth callback request timed out."
    );
}

#[tokio::test]
async fn response_has_byte_length_no_store_and_static_html() {
    let (mut client, mut server) = pair().await;
    write_callback_response(&mut server, "200 OK", "Zażółć")
        .await
        .unwrap();
    drop(server);
    let mut response = String::new();
    client.read_to_string(&mut response).await.unwrap();
    let (headers, body) = response.split_once("\r\n\r\n").unwrap();
    assert!(headers.starts_with("HTTP/1.1 200 OK"));
    assert!(headers.contains("Cache-Control: no-store"));
    assert!(headers.contains(&format!("Content-Length: {}", body.len())));
    assert!(body.ends_with("<p>Zażółć</p>"));
}
