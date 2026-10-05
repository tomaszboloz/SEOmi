use crate::commands::audit_queue;
use serde_json::Value;
use tauri::{AppHandle, Runtime};

pub(super) struct QueueOwner<R: Runtime> {
    pub(super) app: AppHandle<R>,
    pub(super) project_id: String,
    pub(super) run_id: String,
    pub(super) generation: Option<String>,
    pub(super) retire: Box<dyn Fn(String, String) + Send + Sync>,
}

impl<R: Runtime> QueueOwner<R> {
    pub(super) fn update(
        &self,
        expected: &Value,
        update: impl FnOnce() -> Result<Value, String>,
    ) -> Result<bool, String> {
        audit_queue::update_queue_if_current(
            &self.app,
            &self.project_id,
            (expected, self.generation.as_deref()),
            update,
        )
    }
}
