use serde_json::Value;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    time::Duration,
};

pub(super) async fn fixture(
    responses: Vec<(u16, Value)>,
) -> (String, tokio::task::JoinHandle<Vec<Value>>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}/query", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let mut payloads = Vec::new();
        for (status, body) in responses {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            let header_end = loop {
                let mut byte = [0u8];
                stream.read_exact(&mut byte).await.unwrap();
                request.push(byte[0]);
                if request.ends_with(b"\r\n\r\n") {
                    break request.len();
                }
                assert!(request.len() < 16 * 1024);
            };
            let headers = String::from_utf8(request).unwrap().to_lowercase();
            assert!(headers.starts_with("post /query http/1.1"));
            assert!(headers.contains("authorization: bearer synthetic-token\r\n"));
            let size: usize = headers
                .lines()
                .find_map(|line| line.strip_prefix("content-length: "))
                .unwrap()
                .parse()
                .unwrap();
            assert!(header_end > 0);
            let mut bytes = vec![0; size];
            stream.read_exact(&mut bytes).await.unwrap();
            payloads.push(serde_json::from_slice(&bytes).unwrap());
            let body = body.to_string();
            stream.write_all(format!("HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes()).await.unwrap();
        }
        payloads
    });
    (endpoint, task)
}

pub(super) fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap()
}
