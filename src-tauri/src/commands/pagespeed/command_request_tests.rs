use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::oneshot,
    time::{timeout, Duration as TokioDuration},
};
async fn local_reply(status: &str, body: &str) -> (String, oneshot::Receiver<Vec<u8>>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let endpoint = format!("http://{}", listener.local_addr().unwrap());
    let status = status.to_string();
    let body = body.as_bytes().to_vec();
    let (sender, received) = oneshot::channel();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        let mut chunk = [0; 4096];
        loop {
            let size = timeout(TokioDuration::from_secs(2), socket.read(&mut chunk))
                .await
                .unwrap()
                .unwrap();
            if size == 0 {
                break;
            }
            request.extend_from_slice(&chunk[..size]);
            if let Some(header_end) = request
                .windows(4)
                .position(|window| window == b"\r\n\r\n")
                .map(|index| index + 4)
            {
                let headers = String::from_utf8_lossy(&request[..header_end]);
                let body_len = headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        name.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse::<usize>().ok())
                            .flatten()
                    })
                    .unwrap_or(0);
                if request.len() >= header_end + body_len || request.len() >= 64 * 1024 {
                    break;
                }
            }
        }
        let _ = sender.send(request);
        let headers = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        );
        socket.write_all(headers.as_bytes()).await.unwrap();
        socket.write_all(&body).await.unwrap();
    });
    (endpoint, received)
}
fn client() -> reqwest::Client {
    reqwest::Client::builder().no_proxy().build().unwrap()
}
fn lighthouse_body() -> &'static str {
    r#"{"lighthouseResult":{"finalDisplayedUrl":"https://example.com/final","fetchTime":"2026-01-01T00:00:00Z","lighthouseVersion":"12","categories":{"performance":{"score":0.91},"accessibility":{"score":0.82},"best-practices":{"score":0.73},"seo":{"score":0.64}},"audits":{}}}"#
}
async fn pagespeed(url: &str, strategy: &str, endpoint: &str) -> Result<Value, String> {
    run_pagespeed_request(url, strategy, endpoint, "key", &client()).await
}

async fn crux(url: &str, form_factor: &str, endpoint: &str) -> Result<Value, String> {
    query_crux_request(url, form_factor, false, endpoint, "key", &client()).await
}
#[tokio::test]
async fn pagespeed_request_validates_and_maps_local_provider_reply() {
    let (endpoint, request) = local_reply("200 OK", lighthouse_body()).await;
    let result = run_pagespeed_request(
        "https://example.com/page#fragment",
        "mobile",
        &endpoint,
        "synthetic-key",
        &client(),
    )
    .await
    .unwrap();
    assert_eq!(result["requestedUrl"], "https://example.com/page");
    assert_eq!(result["finalUrl"], "https://example.com/final");
    assert_eq!(result["strategy"], "mobile");
    assert_eq!(result["categories"]["performance"], 91.0);
    let request = String::from_utf8(request.await.unwrap()).unwrap();
    assert!(request.contains("strategy=mobile"));
    assert!(request.contains("key=synthetic-key"));
}
#[tokio::test]
async fn pagespeed_request_rejects_strategy_target_and_transport_errors() {
    let error = pagespeed("https://example.com", "tablet", "http://127.0.0.1:1")
        .await
        .unwrap_err();
    assert_eq!(error, "PageSpeed strategy must be mobile or desktop.");
    let error = pagespeed("http://127.0.0.1/private", "desktop", "http://127.0.0.1:1")
        .await
        .unwrap_err();
    assert!(error.contains("local/private IP"));
    let error = pagespeed("https://example.com", "desktop", "http://127.0.0.1:1")
        .await
        .unwrap_err();
    assert!(error.contains("Could not connect to Google PageSpeed"));
}

#[tokio::test]
async fn crux_request_covers_url_origin_not_found_and_transport_paths() {
    for (origin_scope, field, expected) in [
        (false, "url", "https://example.com/page"),
        (true, "origin", "https://example.com"),
    ] {
        let (endpoint, request) = local_reply("200 OK", r#"{"record":{}}"#).await;
        let result = query_crux_request(
            "https://example.com/page#fragment",
            "PHONE",
            origin_scope,
            &endpoint,
            "synthetic-key",
            &client(),
        )
        .await
        .unwrap();
        assert_eq!(result, serde_json::json!({"record": {}}));
        let request = String::from_utf8(request.await.unwrap()).unwrap();
        let body = request.split_once("\r\n\r\n").unwrap().1;
        let body: Value = serde_json::from_str(body).unwrap();
        assert_eq!(body[field], expected);
        assert_eq!(body["formFactor"], "PHONE");
        assert_eq!(body["metrics"].as_array().unwrap().len(), 5);
    }
    let (endpoint, _) = local_reply("404 Not Found", r#"{"error":{}}"#).await;
    let error = crux("https://example.com", "DESKTOP", &endpoint)
        .await
        .unwrap_err();
    assert!(error.starts_with("CRUX_NOT_ENOUGH_DATA:"));
    let error = crux("https://example.com", "PHONE", "http://127.0.0.1:1")
        .await
        .unwrap_err();
    assert!(error.contains("Could not connect to the Chrome UX Report API"));
}
#[tokio::test]
async fn crux_request_rejects_form_factor_and_target_before_network() {
    let error = crux("https://example.com", "MOBILE", "http://127.0.0.1:1")
        .await
        .unwrap_err();
    assert_eq!(error, "CrUX form factor must be PHONE, DESKTOP, or TABLET.");
    let error = crux("http://127.0.0.1/private", "PHONE", "http://127.0.0.1:1")
        .await
        .unwrap_err();
    assert!(error.contains("local/private IP"));
}
