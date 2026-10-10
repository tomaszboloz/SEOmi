use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tauri::{AppHandle, Runtime};
use tokio::{
    sync::{oneshot, Mutex},
    task::JoinHandle,
    time::Instant,
};

pub const RENDER_WORKER_VERSION: &str = "1";
pub(super) const WORKER_TTL: Duration = Duration::from_secs(90);
pub(super) const REQUEST_TIMEOUT: Duration = Duration::from_secs(75);
pub(super) const MAX_HEADER_BYTES: usize = 16 * 1024;
pub(super) const MAX_BODY_BYTES: usize = 64 * 1024;
pub(super) const MAX_REQUEST_BYTES: usize = MAX_HEADER_BYTES + MAX_BODY_BYTES;
pub(super) const MAX_SCOPE_PATH_CHARS: usize = 2_048;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderWorkerLease {
    pub base_url: String,
    pub token: String,
    pub version: String,
    pub expires_at: String,
    pub one_shot: bool,
}

#[derive(Debug, Default)]
pub struct RenderWorkerState {
    pub(super) active: Mutex<Option<WorkerHandle>>,
}

#[derive(Debug)]
pub(super) struct WorkerHandle {
    pub(super) shutdown: Option<oneshot::Sender<()>>,
    pub(super) task: JoinHandle<()>,
}

#[derive(Debug)]
pub(super) struct WorkerShared<R: Runtime = tauri::Wry> {
    pub(super) app: AppHandle<R>,
    pub(super) token: Arc<Mutex<Option<String>>>,
    pub(super) expires_at: Instant,
    pub(super) expires_at_text: String,
}

impl<R: Runtime> Clone for WorkerShared<R> {
    fn clone(&self) -> Self {
        Self {
            app: self.app.clone(),
            token: Arc::clone(&self.token),
            expires_at: self.expires_at,
            expires_at_text: self.expires_at_text.clone(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct RenderWorkerRequest {
    pub(super) url: String,
    #[serde(default)]
    pub(super) allow_subdomains: bool,
    pub(super) scope_path: Option<String>,
    pub(super) wait_for_selector: Option<String>,
    #[serde(default)]
    pub(super) wait_delay_ms: u64,
    #[serde(default)]
    pub(super) lazy_scroll_cycles: usize,
}

#[derive(Debug)]
pub(super) struct HttpRequest {
    pub(super) method: String,
    pub(super) path: String,
    pub(super) headers: HashMap<String, String>,
    pub(super) body: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub(super) struct ErrorResponse {
    pub(super) error: String,
}
