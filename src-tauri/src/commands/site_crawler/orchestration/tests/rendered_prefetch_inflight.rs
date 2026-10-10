use super::super::rendered_prefetch::prefetch_rendered_pages;
use super::*;
use crate::utils::test_app::StorageApp;
use std::sync::Arc;
use std::time::Duration;
use tauri::test::{mock_builder, MockRuntime};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::Notify,
    task::JoinHandle,
};

struct SignalledServer {
    setup: CrawlSetup,
    first_request: Arc<Notify>,
    task: JoinHandle<()>,
}

impl SignalledServer {
    async fn new(config: CrawlConfig, delay: Duration) -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let mut setup = setup(config);
        setup.parsed_base =
            url::Url::parse(&format!("http://example.test:{}/", address.port())).unwrap();
        setup.normalized_start_url = setup.parsed_base.clone();
        setup.client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .resolve("example.test", address)
            .timeout(Duration::from_secs(3))
            .build()
            .unwrap();
        let first_request = Arc::new(Notify::new());
        let signal = first_request.clone();
        let task = tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                signal.notify_one();
                let mut request = [0; 1024];
                let _ = socket.read(&mut request).await;
                tokio::time::sleep(delay).await;
                let _ = socket
                    .write_all(
                        b"HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: 5\r\nConnection: close\r\n\r\nimage",
                    )
                    .await;
            }
        });
        Self {
            setup,
            first_request,
            task,
        }
    }

    fn url(&self, path: &str) -> String {
        self.setup.parsed_base.join(path).unwrap().to_string()
    }
}

impl Drop for SignalledServer {
    fn drop(&mut self) {
        self.task.abort();
    }
}

fn queued_state(urls: &[String]) -> CrawlLoopState<MockRuntime> {
    CrawlLoopState::new(
        Default::default(),
        urls.iter().cloned().map(|url| (url, 1)).collect(),
        Vec::new(),
        Default::default(),
        false,
        false,
    )
}

#[tokio::test]
async fn in_flight_prefetch_aborts_after_real_request_when_cancelled() {
    let mut config = default_crawl_config(Some(2));
    config.crawl_mode = "browser-rendered".into();
    let server = SignalledServer::new(config, Duration::from_millis(500)).await;
    let urls = [server.url("/one"), server.url("/two")];
    let mut state = queued_state(&urls);
    let control = CrawlControl::new();
    let app = StorageApp::new(mock_builder());
    let handle = app.handle();
    {
        let future = prefetch_rendered_pages(&handle, &control, &server.setup, &mut state, 2, &[]);
        tokio::pin!(future);
        tokio::select! {
            _ = server.first_request.notified() => {
                control.cancelled_runs.lock().unwrap().insert(server.setup.run_id.clone());
            }
            _ = &mut future => panic!("prefetch must still be waiting for the delayed response"),
        }
        future.as_mut().await;
    }

    assert_eq!(state.prefetched_order.len(), 2);
    assert!(state.prefetched_responses.is_empty());
}

#[tokio::test]
async fn in_flight_prefetch_aborts_after_real_request_when_deadline_expires() {
    let mut config = default_crawl_config(Some(2));
    config.crawl_mode = "browser-rendered".into();
    config.max_run_seconds = Some(1);
    let server = SignalledServer::new(config, Duration::from_millis(1_500)).await;
    let urls = [server.url("/one"), server.url("/two")];
    let mut state = queued_state(&urls);
    let app = StorageApp::new(mock_builder());
    let handle = app.handle();
    let control = CrawlControl::new();
    {
        let future = prefetch_rendered_pages(&handle, &control, &server.setup, &mut state, 2, &[]);
        tokio::pin!(future);
        tokio::select! {
            _ = server.first_request.notified() => {}
            _ = &mut future => panic!("prefetch must still be waiting for the delayed response"),
        }
        future.as_mut().await;
    }

    assert_eq!(state.prefetched_order.len(), 2);
    assert!(state.prefetched_responses.is_empty());
}
