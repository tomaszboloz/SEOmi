use super::{AuditControl, AuditRateLimiter, AuditTransport};
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::{json, Value};
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tauri::{test::mock_builder, WebviewWindowBuilder};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::Notify,
    task::JoinHandle,
    time::timeout,
};

const HTML: &str = "<!doctype html><html><head><title>IPC fixture</title><meta name=\"description\" content=\"A complete audit fixture.\"><link rel=\"canonical\" href=\"/\"></head><body><main><h1>IPC fixture</h1><p>Audited content.</p></main></body></html>";

struct Fixture {
    address: SocketAddr,
    url: String,
    accepted: Arc<Notify>,
    task: JoinHandle<()>,
}

impl Fixture {
    async fn new(wait_for_cancel: bool) -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let accepted = Arc::new(Notify::new());
        let signal = Arc::clone(&accepted);
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{HTML}",
            HTML.len()
        );
        let task = tokio::spawn(async move {
            let Ok((mut socket, _)) = listener.accept().await else {
                return;
            };
            let mut request = [0; 4096];
            let _ = socket.read(&mut request).await;
            signal.notify_one();
            if wait_for_cancel {
                tokio::time::sleep(Duration::from_secs(5)).await;
            } else {
                let _ = socket.write_all(response.as_bytes()).await;
            }
        });
        Self {
            address,
            url: format!("http://audit.example:{}/", address.port()),
            accepted,
            task,
        }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        self.task.abort();
    }
}

fn app(address: SocketAddr) -> StorageApp {
    let transport = AuditTransport::with_resolver(move |_| async move { Ok(vec![address]) });
    StorageApp::new(
        mock_builder()
            .manage(AuditControl::new())
            .manage(AuditRateLimiter::new())
            .manage(transport)
            .invoke_handler(tauri::generate_handler![
                super::inspect_url,
                super::cancel_inspect_url
            ]),
    )
}

fn view(app: &StorageApp) -> tauri::WebviewWindow<tauri::test::MockRuntime> {
    WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn public_inspect_ipc_returns_the_fixture_audit_result() {
    let fixture = Fixture::new(false).await;
    let app = app(fixture.address);
    let result = invoke(
        &view(&app),
        "inspect_url",
        json!({"url": fixture.url, "requestId": "ipc-success"}),
    )
    .unwrap();
    assert_eq!(result["http_status"], 200);
    assert_eq!(result["meta_tags"]["title"], "IPC fixture");
    assert_eq!(result["headings"]["h1_count"], 1);
    assert_eq!(result["http_performance"]["method"], "GET");
    assert!(timeout(Duration::from_secs(1), fixture.accepted.notified())
        .await
        .is_ok());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn public_cancel_ipc_stops_an_in_flight_inspect_request() {
    let fixture = Fixture::new(true).await;
    let app = app(fixture.address);
    let request_view = view(&app);
    let cancel_view = request_view.clone();
    let url = fixture.url.clone();
    let request = std::thread::spawn(move || {
        invoke(
            &request_view,
            "inspect_url",
            json!({"url": url, "requestId": "ipc-cancel"}),
        )
    });
    timeout(Duration::from_secs(2), fixture.accepted.notified())
        .await
        .expect("fixture must accept the request before cancellation");
    assert_eq!(
        invoke(
            &cancel_view,
            "cancel_inspect_url",
            json!({"requestId": "ipc-cancel"}),
        )
        .unwrap(),
        Value::Bool(true)
    );
    let result = tokio::task::spawn_blocking(move || request.join().unwrap())
        .await
        .unwrap()
        .unwrap_err();
    assert_eq!(result, json!("Audit cancelled by user."));
}
