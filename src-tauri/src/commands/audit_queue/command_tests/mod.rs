use super::*;
use crate::utils::test_app::StorageApp;
use serde_json::json;
use tauri::test::mock_builder;

struct Fixture(StorageApp);
impl std::ops::Deref for Fixture {
    type Target = StorageApp;
    fn deref(&self) -> &StorageApp {
        &self.0
    }
}
impl Fixture {
    fn new() -> Self {
        Self(StorageApp::new(mock_builder().invoke_handler(
            tauri::generate_handler![
                load_project_audit_queue,
                save_project_audit_queue,
                delete_project_audit_queue,
                list_project_audit_queue_executions,
                list_project_audit_queue_results,
                acknowledge_project_audit_queue_execution,
                acknowledge_project_audit_queue_result
            ],
        )))
    }
}

mod errors;
mod handoffs;
mod ipc;
mod limits;
mod paths;
mod snapshots;
