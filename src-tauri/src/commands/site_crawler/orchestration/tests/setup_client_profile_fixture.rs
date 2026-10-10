use crate::commands::settings::{CrawlAuthProfile, CrawlProfileHeader};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

pub(super) fn profile(
    headers: Vec<CrawlProfileHeader>,
    cookie: Option<&str>,
    proxy_url: Option<String>,
) -> CrawlAuthProfile {
    CrawlAuthProfile {
        headers,
        cookie: cookie.map(str::to_owned),
        proxy_url,
    }
}

pub(super) async fn proxy_server() -> (String, tokio::task::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        let mut buffer = [0; 1024];
        loop {
            let count = socket.read(&mut buffer).await.unwrap();
            if count == 0 {
                break;
            }
            request.extend_from_slice(&buffer[..count]);
            if request.windows(4).any(|part| part == b"\r\n\r\n") {
                break;
            }
        }
        socket
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            .await
            .unwrap();
        String::from_utf8(request).unwrap()
    });
    (format!("http://{address}"), task)
}
