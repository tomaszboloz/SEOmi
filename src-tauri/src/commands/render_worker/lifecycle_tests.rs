use super::{
    models::WorkerHandle, render_worker_status, start_render_worker, stop_render_worker,
    RenderWorkerState,
};
use crate::utils::test_app::StorageApp;
use tauri::{test::mock_builder, Manager};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
};

#[tokio::test]
async fn start_replaces_previous_worker_and_stop_is_idempotent() {
    let app = StorageApp::new(mock_builder().manage(RenderWorkerState::default()));
    assert!(!render_worker_status(app.app.state()).await.unwrap());
    let first = start_render_worker(app.handle(), app.app.state())
        .await
        .unwrap();
    assert!(first.one_shot);
    assert_eq!(first.version, "1");
    assert_eq!(first.token.len(), 32);
    let first_task = {
        let state = app.app.state::<RenderWorkerState>();
        let active = state.active.lock().await;
        active.as_ref().unwrap().task.abort_handle()
    };
    let second = start_render_worker(app.handle(), app.app.state())
        .await
        .unwrap();
    assert_ne!(first.token, second.token);
    assert_ne!(first.base_url, second.base_url);
    tokio::time::timeout(std::time::Duration::from_secs(2), async {
        while !first_task.is_finished() {
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("replaced worker must finish after abort");
    assert!(render_worker_status(app.app.state()).await.unwrap());
    let address = second.base_url.strip_prefix("http://").unwrap();
    let mut stream = TcpStream::connect(address).await.unwrap();
    stream
        .write_all(b"GET /health HTTP/1.1\r\nHost: localhost\r\n\r\n")
        .await
        .unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).await.unwrap();
    assert!(response.starts_with("HTTP/1.1 200"));
    assert!(!response.contains(&second.token));
    stop_render_worker(app.app.state()).await.unwrap();
    stop_render_worker(app.app.state()).await.unwrap();
    assert!(!render_worker_status(app.app.state()).await.unwrap());
}

#[tokio::test]
async fn status_removes_a_completed_worker_handle() {
    let app = StorageApp::new(mock_builder().manage(RenderWorkerState::default()));
    let task = tokio::spawn(async {});
    while !task.is_finished() {
        tokio::task::yield_now().await;
    }
    {
        let state = app.app.state::<RenderWorkerState>();
        *state.active.lock().await = Some(WorkerHandle {
            shutdown: None,
            task,
        });
    }
    assert!(!render_worker_status(app.app.state()).await.unwrap());
    assert!(app
        .app
        .state::<RenderWorkerState>()
        .active
        .lock()
        .await
        .is_none());
}
