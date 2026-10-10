use super::{
    render_worker_status, start_render_worker, stop_render_worker, RenderWorkerLease,
    RenderWorkerState,
};
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

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
async fn render_worker_ipc_commands_manage_worker_lifecycle() {
    let app = fixture();
    let view = tauri::WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap();

    let initial = invoke(&view, "render_worker_status", json!({})).unwrap();
    assert_eq!(initial, json!(false));

    let lease_value = invoke(&view, "start_render_worker", json!({})).unwrap();
    let lease: RenderWorkerLease = serde_json::from_value(lease_value.clone()).unwrap();
    assert!(lease.base_url.starts_with("http://127.0.0.1:"));
    assert_eq!(lease.token.len(), 32);
    assert_eq!(lease.version, "1");
    assert!(lease.one_shot);
    assert_eq!(lease_value["baseUrl"], lease.base_url);
    assert_eq!(lease_value["oneShot"], true);

    let active = invoke(&view, "render_worker_status", json!({})).unwrap();
    assert_eq!(active, json!(true));

    let stop = invoke(&view, "stop_render_worker", json!({})).unwrap();
    assert_eq!(stop, serde_json::Value::Null);

    let stopped = invoke(&view, "render_worker_status", json!({})).unwrap();
    assert_eq!(stopped, json!(false));

    let stop_idempotent = invoke(&view, "stop_render_worker", json!({})).unwrap();
    assert_eq!(stop_idempotent, serde_json::Value::Null);
    assert_eq!(
        invoke(&view, "render_worker_status", json!({})).unwrap(),
        json!(false)
    );
}

#[tokio::test]
async fn render_worker_ipc_start_replaces_active_worker() {
    let app = fixture();
    let view = tauri::WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap();

    let first = invoke(&view, "start_render_worker", json!({})).unwrap();
    let first_lease: RenderWorkerLease = serde_json::from_value(first).unwrap();

    let second = invoke(&view, "start_render_worker", json!({})).unwrap();
    let second_lease: RenderWorkerLease = serde_json::from_value(second).unwrap();

    assert_ne!(first_lease.token, second_lease.token);
    assert_ne!(first_lease.base_url, second_lease.base_url);

    assert_eq!(
        invoke(&view, "render_worker_status", json!({})).unwrap(),
        json!(true)
    );

    invoke(&view, "stop_render_worker", json!({})).unwrap();
    assert_eq!(
        invoke(&view, "render_worker_status", json!({})).unwrap(),
        json!(false)
    );
}
