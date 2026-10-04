use super::*;
use serde_json::json;
use std::path::PathBuf;
use tauri::{
    test::{mock_builder, mock_context, noop_assets, MockRuntime},
    Manager,
};

struct Fixture {
    app: tauri::App<MockRuntime>,
    root: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let id = format!("seomi-queue-test-{}", uuid::Uuid::new_v4());
        let mut context = mock_context(noop_assets());
        context.config_mut().identifier = id.clone();
        let app = mock_builder()
            .invoke_handler(tauri::generate_handler![
                load_project_audit_queue,
                save_project_audit_queue,
                delete_project_audit_queue,
                list_project_audit_queue_executions,
                list_project_audit_queue_results,
                acknowledge_project_audit_queue_execution,
                acknowledge_project_audit_queue_result
            ])
            .build(context)
            .unwrap();
        let root = app.path().app_data_dir().unwrap();
        assert_eq!(root.file_name().unwrap().to_str(), Some(id.as_str()));
        Self { app, root }
    }

    fn handle(&self) -> AppHandle<MockRuntime> {
        self.app.handle().clone()
    }
    fn project(&self, id: &str) -> PathBuf {
        crawl_storage::project_directory(self.app.handle(), id).unwrap()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        if self.root.exists() {
            fs::remove_dir_all(&self.root).unwrap();
        }
    }
}

mod errors;
mod handoffs;
mod ipc;
mod limits;
mod paths;
mod snapshots;
