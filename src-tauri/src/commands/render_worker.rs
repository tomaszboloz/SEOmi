mod http;
mod models;
mod render;
mod server;

#[cfg(test)]
mod tests;

use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::{
    net::TcpListener,
    sync::{oneshot, Mutex},
    time::Instant,
};

use models::*;
pub use models::{RenderWorkerLease, RenderWorkerState, RENDER_WORKER_VERSION};
use server::run_worker;

#[tauri::command]
pub async fn start_render_worker(
    app: AppHandle,
    state: State<'_, RenderWorkerState>,
) -> Result<RenderWorkerLease, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|e| format!("Unable to bind the local render worker: {e}"))?;
    let address = listener
        .local_addr()
        .map_err(|e| format!("Unable to read the local render worker address: {e}"))?;
    let token = uuid::Uuid::new_v4().simple().to_string();
    let expires_at = Instant::now() + WORKER_TTL;
    let (shutdown_sender, shutdown_receiver) = oneshot::channel();
    let expires_at_text = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::from_std(WORKER_TTL).expect("fixed duration"))
        .expect("worker expiry is representable")
        .to_rfc3339();
    let shared = WorkerShared {
        app,
        token: Arc::new(Mutex::new(Some(token.clone()))),
        expires_at,
        expires_at_text: expires_at_text.clone(),
    };
    let task = tokio::spawn(run_worker(listener, shared, shutdown_receiver));

    let mut active = state.active.lock().await;
    if let Some(previous) = active.take() {
        let _ = previous.shutdown.map(|sender| sender.send(()));
        previous.task.abort();
    }
    *active = Some(WorkerHandle {
        shutdown: Some(shutdown_sender),
        task,
    });

    Ok(RenderWorkerLease {
        base_url: format!("http://127.0.0.1:{}", address.port()),
        token,
        version: RENDER_WORKER_VERSION.to_string(),
        expires_at: expires_at_text,
        one_shot: true,
    })
}

#[tauri::command]
pub async fn stop_render_worker(state: State<'_, RenderWorkerState>) -> Result<(), String> {
    let mut active = state.active.lock().await;
    if let Some(handle) = active.take() {
        let _ = handle.shutdown.map(|sender| sender.send(()));
        handle.task.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn render_worker_status(state: State<'_, RenderWorkerState>) -> Result<bool, String> {
    let mut active = state.active.lock().await;
    if active
        .as_ref()
        .is_some_and(|handle| handle.task.is_finished())
    {
        active.take();
    }
    Ok(active.is_some())
}
