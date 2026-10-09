use super::{
    models::{RenderWorkerState, WorkerShared},
    render_worker_status,
    server::{handle_connection, run_worker},
    start_render_worker, stop_render_worker,
};
use crate::utils::test_app::StorageApp;
use std::{sync::Arc, time::Duration};
use tauri::{test::mock_builder, Manager};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::Mutex,
    time::Instant,
};

async fn send_raw(raw: &str) -> String {
    let app = StorageApp::new(mock_builder());
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let shared = WorkerShared {
        app: app.handle(),
        token: Arc::new(Mutex::new(Some("test-secret-token".into()))),
        expires_at: Instant::now() + Duration::from_secs(60),
        expires_at_text: "2026-12-31T00:00:00Z".into(),
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

#[tokio::test]
async fn shutdown_receiver_drop_terminates_run_worker_cleanly() {
    let app = StorageApp::new(mock_builder());
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let shared = WorkerShared {
        app: app.handle(),
        token: Arc::new(Mutex::new(Some("tok".into()))),
        expires_at: Instant::now() + Duration::from_secs(60),
        expires_at_text: "2026-12-31T00:00:00Z".into(),
    };
    let (tx, rx) = tokio::sync::oneshot::channel();
    let task = tokio::spawn(run_worker(listener, shared, rx));
    drop(tx);
    assert!(
        task.await.is_ok(),
        "run_worker must exit when shutdown dropped"
    );
}

#[tokio::test]
async fn handle_connection_rejects_malformed_and_unsupported_methods() {
    let malformed = send_raw("NOT AN HTTP REQUEST\r\n\r\n").await;
    assert!(malformed.starts_with("HTTP/1.1 400"));

    for method in ["DELETE", "PUT", "PATCH"] {
        let raw = format!("{method} /v1/render HTTP/1.1\r\nHost: localhost\r\n\r\n");
        let resp = send_raw(&raw).await;
        assert!(resp.starts_with("HTTP/1.1 404"));
        assert!(resp.contains("Worker route not found"));
    }

    let post_health = send_raw("POST /health HTTP/1.1\r\nHost: localhost\r\n\r\n").await;
    assert!(post_health.starts_with("HTTP/1.1 404"));
}

#[tokio::test]
async fn render_endpoint_protocol_error_branches() {
    let bad_ver = send_raw(
        "POST /v1/render HTTP/1.1\r\nHost: localhost\r\nx-seomi-worker-version: 99\r\n\r\n",
    )
    .await;
    assert!(bad_ver.starts_with("HTTP/1.1 426"));

    let bad_auth = send_raw("POST /v1/render HTTP/1.1\r\nHost: localhost\r\nx-seomi-worker-version: 1\r\nAuthorization: Basic dXNlcjpwd2Q=\r\n\r\n").await;
    assert!(bad_auth.starts_with("HTTP/1.1 401"));

    let bad_type = send_raw("POST /v1/render HTTP/1.1\r\nHost: localhost\r\nx-seomi-worker-version: 1\r\nAuthorization: Bearer test-secret-token\r\nContent-Type: text/plain\r\n\r\n").await;
    assert!(bad_type.starts_with("HTTP/1.1 415"));

    let bad_body = send_raw("POST /v1/render HTTP/1.1\r\nHost: localhost\r\nx-seomi-worker-version: 1\r\nAuthorization: Bearer test-secret-token\r\nContent-Type: application/json\r\nContent-Length: 7\r\n\r\n{broken").await;
    assert!(bad_body.starts_with("HTTP/1.1 400"));
}

#[tokio::test]
async fn worker_commands_direct_invocations_and_status_polling() {
    let app = StorageApp::new(mock_builder().manage(RenderWorkerState::default()));
    assert!(!render_worker_status(app.app.state()).await.unwrap());

    let lease = start_render_worker(app.handle(), app.app.state())
        .await
        .unwrap();
    assert_eq!(lease.version, "1");
    assert!(lease.base_url.starts_with("http://127.0.0.1:"));
    assert!(render_worker_status(app.app.state()).await.unwrap());

    stop_render_worker(app.app.state()).await.unwrap();
    assert!(!render_worker_status(app.app.state()).await.unwrap());
    assert!(stop_render_worker(app.app.state()).await.is_ok());
}
