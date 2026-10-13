use super::tests::serve;
use super::{may_follow, rdap_client, rdap_lookup_at, MAX_RDAP_BYTES};

#[test]
fn redirects_need_https_and_a_hop_budget() {
    assert!(may_follow(0, "https"));
    assert!(may_follow(2, "https"));
    assert!(!may_follow(3, "https"));
    assert!(!may_follow(0, "http"));
}

#[tokio::test]
async fn truncated_and_oversized_streams_are_rejected() {
    let client = rdap_client().unwrap();
    let truncated =
        b"HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\n{}".to_vec();
    let base = serve(truncated).await;
    assert_eq!(
        rdap_lookup_at(&client, &base, "example.com")
            .await
            .unwrap_err(),
        "RDAP response could not be read."
    );

    let mut chunked =
        b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n".to_vec();
    chunked.extend_from_slice(format!("{:x}\r\n", MAX_RDAP_BYTES + 1).as_bytes());
    chunked.extend(vec![b' '; MAX_RDAP_BYTES + 1]);
    chunked.extend_from_slice(b"\r\n0\r\n\r\n");
    let base = serve(chunked).await;
    assert_eq!(
        rdap_lookup_at(&client, &base, "example.com")
            .await
            .unwrap_err(),
        "RDAP response exceeds byte limit."
    );
}

#[tokio::test]
async fn requests_identify_the_application() {
    // rdap.org answers 403 to a request without a User-Agent header.
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let request = tokio::spawn(async move {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut buffer = [0u8; 2048];
        let read = socket.read(&mut buffer).await.unwrap();
        let reply = b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}";
        let _ = socket.write_all(reply).await;
        String::from_utf8_lossy(&buffer[..read]).to_ascii_lowercase()
    });
    let client = rdap_client().unwrap();
    rdap_lookup_at(&client, &base, "example.com").await.unwrap();
    let expected = format!("user-agent: seomi/{}", env!("CARGO_PKG_VERSION"));
    assert!(request.await.unwrap().contains(&expected));
}
