use serde_json::Value;
use std::{fs, path::PathBuf};
use tauri::{
    test::{mock_context, noop_assets, MockRuntime},
    Manager,
};

/// Isolated OS-backed storage for the real command implementations.
pub struct StorageApp {
    pub app: tauri::App<MockRuntime>,
    pub root: PathBuf,
}

impl StorageApp {
    pub fn new(builder: tauri::Builder<MockRuntime>) -> Self {
        let identifier = format!("seomi-storage-test-{}", uuid::Uuid::new_v4());
        let mut context = mock_context(noop_assets());
        context.config_mut().identifier = identifier.clone();
        let app = builder.build(context).unwrap();
        let root = app.path().app_data_dir().unwrap();
        assert_eq!(
            root.file_name().unwrap().to_str(),
            Some(identifier.as_str())
        );
        Self { app, root }
    }
    pub fn handle(&self) -> tauri::AppHandle<MockRuntime> {
        self.app.handle().clone()
    }
    pub fn project(&self, id: &str) -> PathBuf {
        crate::commands::crawl_storage::project_directory(self.app.handle(), id).unwrap()
    }
}

impl Drop for StorageApp {
    fn drop(&mut self) {
        if self.root.exists() {
            fs::remove_dir_all(&self.root).unwrap();
        }
    }
}

pub fn invoke(
    view: &tauri::WebviewWindow<MockRuntime>,
    command: &str,
    body: Value,
) -> Result<Value, Value> {
    tauri::test::get_ipc_response(
        view,
        tauri::webview::InvokeRequest {
            cmd: command.into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: if cfg!(windows) {
                "http://tauri.localhost"
            } else {
                "tauri://localhost"
            }
            .parse()
            .unwrap(),
            body: tauri::ipc::InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        },
    )
    .map(|response| response.deserialize().unwrap())
}
