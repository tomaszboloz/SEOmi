use serde_json::{json, Value};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
};

pub(super) async fn fixture() -> (String, tokio::task::JoinHandle<Vec<Value>>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}/query", listener.local_addr().unwrap());
    let task = tokio::spawn(async move {
        let mut payloads = Vec::new();
        for _ in 0..5 {
            let (mut stream, _) = listener.accept().await.unwrap();
            let (headers, bytes) = read_request(&mut stream).await;
            assert!(headers.starts_with("post /query http/1.1"));
            assert!(headers.contains("authorization: bearer synthetic-token\r\n"));
            let payload: Value = serde_json::from_slice(&bytes).unwrap();
            let body = response_for(&payload).to_string();
            stream
                .write_all(format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                ).as_bytes())
                .await
                .unwrap();
            payloads.push(payload);
        }
        payloads
    });
    (endpoint, task)
}

async fn read_request(stream: &mut TcpStream) -> (String, Vec<u8>) {
    let mut request = Vec::new();
    loop {
        let mut byte = [0u8];
        stream.read_exact(&mut byte).await.unwrap();
        request.push(byte[0]);
        if request.ends_with(b"\r\n\r\n") {
            break;
        }
        assert!(request.len() < 16 * 1024);
    }
    let headers = String::from_utf8(request).unwrap().to_ascii_lowercase();
    let size = headers
        .lines()
        .find_map(|line| line.strip_prefix("content-length: "))
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap();
    let mut body = vec![0; size];
    stream.read_exact(&mut body).await.unwrap();
    (headers, body)
}

fn response_for(payload: &Value) -> Value {
    let dimensions = payload
        .get("dimensions")
        .and_then(Value::as_array)
        .map(|values| values.iter().filter_map(Value::as_str).collect::<Vec<_>>())
        .unwrap_or_default();
    match dimensions.as_slice() {
        ["query"] => {
            json!({"rows":[{"keys":["query-key"],"clicks":2,"impressions":20,"ctr":0.1,"position":3.25}]})
        }
        ["page"] => {
            json!({"rows":[{"keys":["https://fixture.test/page"],"clicks":3,"impressions":30,"ctr":0.2,"position":4.25}]})
        }
        ["date"] => {
            json!({"rows":[{"keys":["2020-01-02"],"clicks":4,"impressions":40,"ctr":0.3,"position":5.25}]})
        }
        ["query", "page"] => {
            json!({"rows":[{"keys":["pair-query","https://fixture.test/pair"],"clicks":5,"impressions":50,"ctr":0.4,"position":6.25}]})
        }
        [] => json!({"rows":[{"clicks":7,"impressions":70,"ctr":0.5,"position":7.25}]}),
        other => panic!("unexpected dimensions: {other:?}"),
    }
}
