use serde_json::{json, Value};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
};

#[derive(Debug)]
pub(super) struct Request {
    pub(super) path: String,
    pub(super) headers: String,
    pub(super) body: Vec<u8>,
}

pub(super) async fn server() -> (String, tokio::task::JoinHandle<Vec<Request>>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let mut requests = Vec::new();
        for _ in 0..4 {
            let (mut stream, _) = listener.accept().await.unwrap();
            let request = read_request(&mut stream).await;
            let body = response_body(&request.path, &request.body);
            let head = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            stream.write_all(head.as_bytes()).await.unwrap();
            stream.write_all(body.as_bytes()).await.unwrap();
            stream.shutdown().await.unwrap();
            requests.push(request);
        }
        requests
    });
    (endpoint, task)
}

pub(super) async fn server_empty() -> (String, tokio::task::JoinHandle<Vec<Request>>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let request = read_request(&mut stream).await;
        let body = b"{\"accountSummaries\":[]}";
        let head = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
        stream.write_all(head.as_bytes()).await.unwrap();
        stream.write_all(body).await.unwrap();
        stream.shutdown().await.unwrap();
        vec![request]
    });
    (endpoint, task)
}

pub(super) async fn read_request(stream: &mut TcpStream) -> Request {
    let mut bytes = Vec::new();
    loop {
        let mut byte = [0u8; 1];
        stream.read_exact(&mut byte).await.unwrap();
        bytes.push(byte[0]);
        if bytes.ends_with(b"\r\n\r\n") {
            break;
        }
        assert!(bytes.len() < 32 * 1024);
    }
    let headers = String::from_utf8(bytes).unwrap().to_ascii_lowercase();
    let path = headers
        .lines()
        .next()
        .unwrap()
        .split_whitespace()
        .nth(1)
        .unwrap()
        .to_string();
    let length = headers
        .lines()
        .find_map(|line| line.strip_prefix("content-length: "))
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    let mut body = vec![0; length];
    stream.read_exact(&mut body).await.unwrap();
    Request {
        path,
        headers,
        body,
    }
}

fn response_body(path: &str, body: &[u8]) -> String {
    let route = path.split('?').next().unwrap_or(path);
    if route.ends_with("/accountsummaries") {
        return json!({"accountSummaries":[{"propertySummaries":[{"property":"properties/9","displayName":"Main"}]}]}).to_string();
    }
    if route.contains("/datastreams") {
        return json!({"dataStreams":[
            {"name":"properties/9/dataStreams/0","type":"ANDROID_APP_DATA_STREAM"},
            {"name":"properties/9/dataStreams/1","type":"WEB_DATA_STREAM","webStreamData":{"defaultUri":"https://example.com","measurementId":"G-TEST"}}
        ]}).to_string();
    }
    let offset = serde_json::from_slice::<Value>(body)
        .ok()
        .and_then(|value| value["offset"].as_u64())
        .unwrap_or(0);
    if offset == 0 {
        json!({"rowCount":3,"rows":[row("/", "2"), row("/pricing?q=x", "3")]}).to_string()
    } else {
        json!({"rowCount":3,"rows":[row("/contact", "1")]}).to_string()
    }
}

fn row(page: &str, sessions: &str) -> Value {
    json!({"dimensionValues":[{"value":page},{"value":"example.com"}],"metricValues":[{"value":sessions},{"value":"1"},{"value":"0"}]})
}
