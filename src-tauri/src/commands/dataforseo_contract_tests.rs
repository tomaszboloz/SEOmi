use super::dataforseo_request_at;
use serde_json::{json, Value};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::oneshot,
};

async fn server(status: &str, body: &str) -> (String, oneshot::Receiver<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let (sender, received) = oneshot::channel();
    let status = status.to_string();
    let body = body.to_string();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        loop {
            let mut chunk = [0; 1024];
            let count = stream.read(&mut chunk).await.unwrap();
            request.extend_from_slice(&chunk[..count]);
            if request.windows(4).any(|window| window == b"\r\n\r\n") {
                break;
            }
        }
        let head_end = request
            .windows(4)
            .position(|window| window == b"\r\n\r\n")
            .unwrap()
            + 4;
        let headers = String::from_utf8_lossy(&request[..head_end]);
        let length = headers
            .lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                name.eq_ignore_ascii_case("content-length")
                    .then(|| value.trim().parse::<usize>().unwrap())
            })
            .unwrap_or(0);
        let already_read = request.len() - head_end;
        if length > already_read {
            let mut tail = vec![0; length - already_read];
            stream.read_exact(&mut tail).await.unwrap();
            request.extend_from_slice(&tail);
        }
        let _ = sender.send(String::from_utf8_lossy(&request).into_owned());
        let reply = format!(
            "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(reply.as_bytes()).await.unwrap();
    });
    (format!("http://{address}"), received)
}

fn client() -> reqwest::Client {
    reqwest::Client::builder().no_proxy().build().unwrap()
}

#[tokio::test]
async fn rejects_unknown_endpoint_before_reading_credentials() {
    let error = dataforseo_request_at(
        "project",
        "/v3/not-allowed",
        None,
        "http://127.0.0.1:1",
        &client(),
        |_| panic!("credentials must not be read"),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "Unsupported DataForSEO endpoint.");
}

#[tokio::test]
async fn sends_get_with_basic_auth_without_payload() {
    let (base, request) = server("200 OK", r#"{"ok":true}"#).await;
    let value = dataforseo_request_at(
        "project",
        "/v3/appendix/user_data",
        Some(json!({"ignored": true})),
        &base,
        &client(),
        |_| Ok(("login".into(), "pass".into())),
    )
    .await
    .unwrap();
    let request = request.await.unwrap();
    assert!(request.starts_with("GET /v3/appendix/user_data HTTP/1.1"));
    assert!(request.contains("authorization: Basic bG9naW46cGFzcw=="));
    assert!(!request.contains("ignored"));
    assert_eq!(value, json!({"ok": true}));
}

#[tokio::test]
async fn sends_post_payload_and_reports_provider_errors() {
    let (base, request) = server("200 OK", r#"{"task":1}"#).await;
    let value = dataforseo_request_at(
        "project",
        "/v3/serp/google/organic/live/regular",
        Some(json!({"keyword":"seo"})),
        &base,
        &client(),
        |_| Ok(("u".into(), "p".into())),
    )
    .await
    .unwrap();
    let request = request.await.unwrap();
    assert!(request.starts_with("POST /v3/serp/google/organic/live/regular HTTP/1.1"));
    let body = request.split("\r\n\r\n").nth(1).unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(body).unwrap(),
        json!({"keyword":"seo"})
    );
    assert_eq!(value, json!({"task": 1}));

    let (base, _) = server("503 Service Unavailable", "temporarily down").await;
    let error = dataforseo_request_at(
        "project",
        "/v3/serp/google/organic/live/regular",
        None,
        &base,
        &client(),
        |_| Ok(("u".into(), "p".into())),
    )
    .await
    .unwrap_err();
    assert!(error.contains("DataForSEO HTTP 503"));
}

#[tokio::test]
async fn rejects_malformed_provider_json() {
    let (base, _) = server("200 OK", "not-json").await;
    let error = dataforseo_request_at(
        "project",
        "/v3/appendix/user_data",
        None,
        &base,
        &client(),
        |_| Ok(("u".into(), "p".into())),
    )
    .await
    .unwrap_err();
    assert_eq!(error, "DataForSEO returned an invalid response.");
}
