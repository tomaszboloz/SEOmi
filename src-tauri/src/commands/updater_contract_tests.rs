use super::{check_for_updates_with, install_update_with};
use crate::utils::test_app::invoke;
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
    let (status, body) = (status.to_string(), body.to_vec());
    let (sender, received) = oneshot::channel();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let (mut req, mut buf) = (Vec::new(), [0u8; 1024]);
        while !req.windows(4).any(|b| b == b"\r\n\r\n") {
            let n = stream.read(&mut buf).await.unwrap();
            req.extend_from_slice(&buf[..n]);
        }
        let res = format!(
            "HTTP/1.1 {status}\r\nConnection: close\r\nContent-Length: {}\r\n\r\n",
            body.len()
        );
        let _ = stream.write_all(res.as_bytes()).await;
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
        .invoke_handler(tauri::generate_handler![
            super::check_for_updates,
            super::install_update
        ])
        .build(context)
        .unwrap()
}

fn handle(endpoint: Option<&str>) -> tauri::AppHandle<MockRuntime> {
    app(endpoint).handle().clone()
}

#[tokio::test]
async fn check_command_maps_empty_and_available_responses() {
    let (url, done) = serve("204 No Content", b"").await;
    let result = super::check_for_updates(handle(Some(&url))).await.unwrap();
    done.await.unwrap();
    assert!(!result.available && result.current_version == env!("CARGO_PKG_VERSION"));

    let (url, done) = serve(
        "200 OK",
        br#"{"version":"0.2.0","url":"https://u.test","signature":"s"}"#,
    )
    .await;
    let result = super::check_for_updates(handle(Some(&url))).await.unwrap();
    done.await.unwrap();
    assert_eq!(
        (result.available, result.installed, result.restart_required),
        (true, false, false)
    );
    assert_eq!(result.version.as_deref(), Some("0.2.0"));
}

#[tokio::test]
async fn commands_preserve_initialization_and_check_errors() {
    assert!(super::check_for_updates(handle(None))
        .await
        .unwrap_err()
        .starts_with("Updater initialization:"));
    let (url, done) = serve("200 OK", b"not-json").await;
    assert!(super::check_for_updates(handle(Some(&url)))
        .await
        .unwrap_err()
        .starts_with("Update check failed:"));
    done.await.unwrap();
    let (url, done) = serve("204 No Content", b"").await;
    assert_eq!(
        super::install_update(handle(Some(&url))).await.unwrap_err(),
        "No update is available"
    );
    done.await.unwrap();
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

#[tokio::test]
async fn install_preserves_initialization_and_manifest_failures() {
    assert!(super::install_update(handle(None))
        .await
        .unwrap_err()
        .starts_with("Updater initialization:"));
    for (status, body) in [
        ("200 OK", &b"not-json"[..]),
        ("404 Not Found", &b"missing"[..]),
    ] {
        let (url, done) = serve(status, body).await;
        assert!(install_update_with(handle(Some(&url)))
            .await
            .unwrap_err()
            .starts_with("Update check failed:"));
        done.await.unwrap();
    }
}

#[tokio::test]
async fn check_missing_or_older_release_never_offers_installation() {
    for (status, body) in [
        ("404 Not Found", &b"missing"[..]),
        (
            "200 OK",
            &br#"{"version":"0.0.1","url":"https://u.test","signature":"s"}"#[..],
        ),
    ] {
        let (url, done) = serve(status, body).await;
        let result = check_for_updates_with(handle(Some(&url))).await.unwrap();
        done.await.unwrap();
        assert!(
            !result.available
                && !result.installed
                && !result.restart_required
                && result.version.is_none()
        );
    }
}
