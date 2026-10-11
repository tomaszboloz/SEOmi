use super::{render_worker_status, start_render_worker, stop_render_worker, RenderWorkerState};
use crate::utils::test_app::StorageApp;
use tauri::test::mock_builder;
use tauri::Manager;

fn fixture() -> StorageApp {
    StorageApp::new(
        mock_builder()
            .manage(RenderWorkerState::default())
            .invoke_handler(tauri::generate_handler![
                start_render_worker,
                stop_render_worker,
                render_worker_status
            ]),
    )
}

#[tokio::test]
async fn test_direct_rust_calls_coverage() {
    let app = fixture();
    let app_handle = app.app.handle().clone();
    let state = app.app.state::<RenderWorkerState>();

    // 1. Initial status -> false
    let initial_status = render_worker_status(state.clone()).await.unwrap();
    assert!(!initial_status);

    // 2. Start worker via direct call
    let lease1 = start_render_worker(app_handle.clone(), state.clone())
        .await
        .unwrap();
    assert!(!lease1.token.is_empty());

    // Status -> true
    let active_status = render_worker_status(state.clone()).await.unwrap();
    assert!(active_status);

    // 3. Start another worker to hit active worker replacement/abort branch
    let lease2 = start_render_worker(app_handle.clone(), state.clone())
        .await
        .unwrap();
    assert_ne!(lease1.token, lease2.token);

    // 4. Stop worker
    stop_render_worker(state.clone()).await.unwrap();
    let stopped_status = render_worker_status(state.clone()).await.unwrap();
    assert!(!stopped_status);

    // 5. Test finished task cleanup branch in render_worker_status
    let _lease3 = start_render_worker(app_handle.clone(), state.clone())
        .await
        .unwrap();
    {
        let mut active = state.active.lock().await;
        if let Some(handle) = active.take() {
            handle.task.abort();
            *active = Some(handle);
        }
    }
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;

    let finished_status = render_worker_status(state.clone()).await.unwrap();
    assert!(!finished_status);
}
