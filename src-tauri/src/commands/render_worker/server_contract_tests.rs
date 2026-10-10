use super::{models::WorkerShared, server::handle_connection};
use crate::utils::test_app::StorageApp;
use std::{sync::Arc, time::Duration};
use tauri::test::mock_builder;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::Mutex,
    time::Instant,
};

async fn request(raw: &str, expired: bool) -> String {
    let app = StorageApp::new(mock_builder());
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let shared = WorkerShared {
        app: app.handle(),
        token: Arc::new(Mutex::new(Some("synthetic-token".into()))),
        expires_at: if expired {
            Instant::now() - Duration::from_secs(1)
        } else {
            Instant::now() + Duration::from_secs(60)
        },
        expires_at_text: "fixture expiry".into(),
    };
    let server = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        handle_connection(stream, shared).await.unwrap();
    });
    let mut stream = TcpStream::connect(address).await.unwrap();
    stream.write_all(raw.as_bytes()).await.unwrap();
    stream.shutdown().await.unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).await.unwrap();
    server.await.unwrap();
    response
}

fn render_request(extra: &str, body: &str) -> String {
    format!(
        "POST /v1/render HTTP/1.1\r\nHost: localhost\r\n{extra}Content-Length: {}\r\n\r\n{body}",
        body.len()
    )
}

#[tokio::test]
async fn health_reports_actual_lease_expiry_and_unknown_routes() {
    for expired in [false, true] {
        let response = request("GET /health HTTP/1.1\r\nHost: localhost\r\n\r\n", expired).await;
        assert!(response.starts_with(if expired {
            "HTTP/1.1 410"
        } else {
            "HTTP/1.1 200"
        }));
        let body: serde_json::Value =
            serde_json::from_str(response.split("\r\n\r\n").nth(1).unwrap()).unwrap();
        assert_eq!(body["ok"], !expired);
        assert_eq!(body["version"], "1");
    }
    let response = request("GET /unknown HTTP/1.1\r\nHost: localhost\r\n\r\n", false).await;
    assert!(response.starts_with("HTTP/1.1 404"));
    assert!(response.contains("Worker route not found"));
}

#[tokio::test]
async fn render_guards_reject_expired_version_token_content_type_and_json() {
    let valid = "x-seomi-worker-version: 1\r\nAuthorization: Bearer synthetic-token\r\n";
    for (extra, body, expired, status, message) in [
        (valid, "{}", true, 410, "lease has expired"),
        ("", "{}", false, 426, "protocol version"),
        ("x-seomi-worker-version: 1\r\n", "{}", false, 401, "token is invalid"),
        (valid, "{}", false, 415, "Content-Type"),
        ("x-seomi-worker-version: 1\r\nAuthorization: Bearer synthetic-token\r\nContent-Type: application/json\r\n", "not-json", false, 400, "Invalid render request"),
    ] {
        let response = request(&render_request(extra, body), expired).await;
        assert!(response.starts_with(&format!("HTTP/1.1 {status}")), "{response}");
        assert!(response.contains(message), "{response}");
        assert!(!response.contains("synthetic-token"));
    }
}

#[tokio::test]
async fn valid_protocol_reaches_real_url_validation_without_opening_a_webview() {
    let extra = "x-seomi-worker-version: 1\r\nAuthorization: Bearer synthetic-token\r\nContent-Type: application/json\r\n";
    let response = request(
        &render_request(extra, r#"{"url":"http://127.0.0.1/private"}"#),
        false,
    )
    .await;
    assert!(response.starts_with("HTTP/1.1 422"), "{response}");
    assert!(
        response.contains("local/private IP addresses"),
        "{response}"
    );
}

#[tokio::test]
async fn run_worker_terminates_on_shutdown_channel_and_expiration() {
    use super::server::run_worker;
    let app = StorageApp::new(mock_builder());
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let shared = WorkerShared {
        app: app.handle(),
        token: Arc::new(Mutex::new(Some("tok".into()))),
        expires_at: Instant::now() + Duration::from_secs(60),
        expires_at_text: "exp".into(),
    };
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();
    let task = tokio::spawn(run_worker(listener, shared, shutdown_rx));
    let _ = shutdown_tx.send(());
    assert!(task.await.is_ok());

    let listener2 = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let expired_shared = WorkerShared {
        app: app.handle(),
        token: Arc::new(Mutex::new(Some("tok".into()))),
        expires_at: Instant::now() - Duration::from_millis(1),
        expires_at_text: "exp".into(),
    };
    let (_shutdown_tx2, shutdown_rx2) = tokio::sync::oneshot::channel();
    let task2 = tokio::spawn(run_worker(listener2, expired_shared, shutdown_rx2));
    assert!(task2.await.is_ok());
}
