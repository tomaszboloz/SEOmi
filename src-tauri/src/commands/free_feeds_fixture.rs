use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::oneshot,
};

async fn consume_request(stream: &mut TcpStream) {
    let mut headers = Vec::new();
    let mut buffer = [0u8; 1024];
    while headers.len() < 16 * 1024 {
        let read = stream.read(&mut buffer).await.unwrap();
        assert!(
            read > 0,
            "client closed before sending complete request headers"
        );
        headers.extend_from_slice(&buffer[..read]);
        if headers.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
            return;
        }
    }
    panic!("fixture request headers exceeded their bound");
}

pub async fn server(
    status: &str,
    body: &[u8],
    content_length: bool,
) -> (UrlString, oneshot::Receiver<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let status = status.to_string();
    let body = body.to_vec();
    let (sender, received) = oneshot::channel();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        consume_request(&mut stream).await;
        let mut headers = format!("HTTP/1.1 {status}\r\nConnection: close\r\n");
        if content_length {
            headers.push_str(&format!("Content-Length: {}\r\n", body.len()));
        }
        headers.push_str("\r\n");
        let _ = stream.write_all(headers.as_bytes()).await;
        let _ = stream.write_all(&body).await;
        let _ = stream.shutdown().await;
        let _ = sender.send(());
    });
    (format!("http://{address}"), received)
}

pub async fn malformed_chunked_server() -> (UrlString, oneshot::Receiver<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let (sender, received) = oneshot::channel();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        consume_request(&mut stream).await;
        let response = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\nZZ\r\ninvalid\r\n";
        let _ = stream.write_all(response).await;
        let _ = stream.shutdown().await;
        let _ = sender.send(());
    });
    (format!("http://{address}"), received)
}

pub type UrlString = String;
