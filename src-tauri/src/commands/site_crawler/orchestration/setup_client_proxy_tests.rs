use super::*;

#[test]
fn single_proxy_and_lists_build_while_bad_lists_are_rejected() {
    assert!(rotating_proxy("http://a.test:8080").is_ok());
    assert!(rotating_proxy("http://a.test:8080, http://b.test:8080;https://c.test:443").is_ok());
    assert!(rotating_proxy("http://a.test:1 http://a.test:1")
        .unwrap_err()
        .contains("Duplicate"));
    assert!(rotating_proxy("socks5://a.test:1,http://b.test:1").is_err());
    assert!(rotating_proxy("   ").is_err());
}

#[tokio::test]
async fn list_rotates_requests_across_proxies() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut addresses = Vec::new();
    let mut hits = Vec::new();
    for _ in 0..2 {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        addresses.push(format!("http://{}", listener.local_addr().unwrap()));
        let counter = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        hits.push(counter.clone());
        tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                let counter = counter.clone();
                tokio::spawn(async move {
                    let mut buffer = [0u8; 1024];
                    let _ = socket.read(&mut buffer).await;
                    counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    let _ = socket
                        .write_all(
                            b"HTTP/1.1 200 OK\r\ncontent-length: 0\r\nconnection: close\r\n\r\n",
                        )
                        .await;
                });
            }
        });
    }
    let proxy = rotating_proxy(&addresses.join(",")).unwrap();
    let client = reqwest::Client::builder().proxy(proxy).build().unwrap();
    for index in 0..4 {
        let response = client
            .get(format!("http://rotation.test/{index}"))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
    }
    assert_eq!(hits[0].load(std::sync::atomic::Ordering::SeqCst), 2);
    assert_eq!(hits[1].load(std::sync::atomic::Ordering::SeqCst), 2);
}
