use super::*;
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

fn fixture() -> StorageApp {
    StorageApp::new(mock_builder().invoke_handler(tauri::generate_handler![
        load_project_crawl_runs,
        save_project_crawl_runs,
        load_project_crawl_checkpoint,
        save_project_crawl_checkpoint,
        delete_project_crawl_checkpoint
    ]))
}

mod checkpoints;
mod errors;
mod histories;
mod ipc;
