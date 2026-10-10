use std::{net::SocketAddr, time::Duration};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    task::JoinHandle,
    time::timeout,
};

const MAX_FIXTURE_REQUEST: usize = 16 * 1024;

pub(super) async fn response_fixture(response: &'static [u8]) -> (SocketAddr, JoinHandle<Vec<u8>>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let request = read_request(&mut stream).await;
        stream.write_all(response).await.unwrap();
        stream.shutdown().await.unwrap();
        request
    });
    (address, task)
}

pub(super) async fn tunnel_fixture(response: &'static [u8]) -> (SocketAddr, JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        stream.write_all(response).await.unwrap();
        stream.shutdown().await.unwrap();
    });
    (address, task)
}

async fn read_request(stream: &mut TcpStream) -> Vec<u8> {
    let mut request = Vec::new();
    loop {
        if let Some(end) = request.windows(4).position(|part| part == b"\r\n\r\n") {
            let header_end = end + 4;
            let content_length = content_length(&request[..end]);
            assert!(header_end + content_length <= MAX_FIXTURE_REQUEST);
            while request.len() < header_end + content_length {
                read_more(stream, &mut request).await;
            }
            request.truncate(header_end + content_length);
            return request;
        }
        read_more(stream, &mut request).await;
    }
}

fn content_length(header: &[u8]) -> usize {
    std::str::from_utf8(header)
        .unwrap()
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.trim()
                .eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse().unwrap())
        })
        .unwrap_or(0)
}

async fn read_more(stream: &mut TcpStream, request: &mut Vec<u8>) {
    let mut chunk = [0; 1024];
    let size = timeout(Duration::from_secs(1), stream.read(&mut chunk))
        .await
        .unwrap()
        .unwrap();
    assert!(size > 0, "fixture received a truncated request");
    request.extend_from_slice(&chunk[..size]);
    assert!(request.len() <= MAX_FIXTURE_REQUEST);
}
