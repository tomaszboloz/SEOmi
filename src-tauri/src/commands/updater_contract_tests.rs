use super::{check_for_updates_with, install_update_with};
use serde_json::json;
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::oneshot,
};

async fn serve(status: &str, body: &[u8]) -> (String, oneshot::Receiver<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let status = status.to_string();
    let body = body.to_vec();
    let (sender, received) = oneshot::channel();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        let mut buffer = [0u8; 1024];
        while !request.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
            assert!(
                request.len() < 16 * 1024,
                "fixture request headers exceeded their bound"
            );
            let read = stream.read(&mut buffer).await.unwrap();
            assert!(read > 0, "fixture request headers were incomplete");
            request.extend_from_slice(&buffer[..read]);
        }
        let response = format!(
            "HTTP/1.1 {status}\r\nConnection: close\r\nContent-Length: {}\r\n\r\n",
            body.len()
        );
        let _ = stream.write_all(response.as_bytes()).await;
        let _ = stream.write_all(&body).await;
        let _ = stream.shutdown().await;
        let _ = sender.send(());
    });
    (format!("http://{address}"), received)
}

fn app(endpoint: Option<&str>) -> tauri::App<MockRuntime> {
    let mut context = mock_context(noop_assets());
    context.config_mut().plugins.0.insert(
        "updater".into(),
        json!({ "pubkey": "", "endpoints": endpoint.into_iter().collect::<Vec<_>>() }),
    );
    mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap()
}

fn handle(endpoint: Option<&str>) -> tauri::AppHandle<MockRuntime> {
    app(endpoint).handle().clone()
}

#[tokio::test]
async fn check_command_maps_empty_and_available_responses() {
    let (url, done) = serve("204 No Content", b"").await;
    let result = check_for_updates_with(handle(Some(&url))).await.unwrap();
    done.await.unwrap();
    assert!(!result.available);
    assert_eq!(result.current_version, env!("CARGO_PKG_VERSION"));

    let body = br#"{"version":"0.2.0","url":"https://updates.test/app","signature":"invalid"}"#;
    let (url, done) = serve("200 OK", body).await;
    let result = check_for_updates_with(handle(Some(&url))).await.unwrap();
    done.await.unwrap();
    assert_eq!(
        (result.available, result.installed, result.restart_required),
        (true, false, false)
    );
    assert_eq!(result.version.as_deref(), Some("0.2.0"));
}

#[tokio::test]
async fn commands_preserve_initialization_and_check_errors() {
    let error = check_for_updates_with(handle(None)).await.unwrap_err();
    assert!(error.starts_with("Updater initialization:"));

    let (url, done) = serve("200 OK", b"not-json").await;
    let error = check_for_updates_with(handle(Some(&url)))
        .await
        .unwrap_err();
    done.await.unwrap();
    assert!(error.starts_with("Update check failed:"));

    let (url, done) = serve("204 No Content", b"").await;
    let error = install_update_with(handle(Some(&url))).await.unwrap_err();
    done.await.unwrap();
    assert_eq!(error, "No update is available");
}

#[tokio::test]
async fn install_command_reports_download_or_signature_failures() {
    let (download, download_done) = serve("200 OK", b"not-an-installer").await;
    let body =
        format!("{{\"version\":\"0.2.0\",\"url\":\"{download}\",\"signature\":\"invalid\"}}");
    let (url, endpoint_done) = serve("200 OK", body.as_bytes()).await;
    let error = install_update_with(handle(Some(&url))).await.unwrap_err();
    endpoint_done.await.unwrap();
    download_done.await.unwrap();
    assert!(error.starts_with("Update installation failed:"));
}
