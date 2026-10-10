use serde_json::json;
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::oneshot,
};

pub(super) async fn serve(status: &str, body: &[u8]) -> (String, oneshot::Receiver<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let (status, body) = (status.to_string(), body.to_vec());
    let (sender, received) = oneshot::channel();
    tokio::spawn(async move {
        let (mut stream, _) =
            tokio::time::timeout(std::time::Duration::from_secs(3), listener.accept())
                .await
                .expect("updater fixture must receive a connection")
                .unwrap();
        let (mut req, mut buf) = (Vec::new(), [0u8; 1024]);
        while !req.windows(4).any(|b| b == b"\r\n\r\n") {
            let n = tokio::time::timeout(std::time::Duration::from_secs(3), stream.read(&mut buf))
                .await
                .expect("updater fixture must receive headers")
                .unwrap();
            assert!(n > 0, "updater fixture received premature EOF");
            assert!(
                req.len() + n <= 16 * 1024,
                "updater fixture headers exceed the limit"
            );
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
            super::super::check_for_updates,
            super::super::install_update
        ])
        .build(context)
        .unwrap()
}

pub(super) fn handle(endpoint: Option<&str>) -> tauri::AppHandle<MockRuntime> {
    app(endpoint).handle().clone()
}
