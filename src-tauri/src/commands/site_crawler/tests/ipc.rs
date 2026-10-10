use super::*;
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::{json, Value};
use tauri::{test::mock_builder, Manager, WebviewWindowBuilder};

fn fixture() -> StorageApp {
    StorageApp::new(mock_builder().manage(CrawlControl::new()).invoke_handler(
        tauri::generate_handler![cancel_site_crawl, pause_site_crawl, resume_site_crawl],
    ))
}

fn view(app: &StorageApp) -> tauri::WebviewWindow<tauri::test::MockRuntime> {
    WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap()
}

#[test]
fn control_commands_preserve_cancel_and_pause_invariants() {
    let app = fixture();
    let view = view(&app);
    assert_eq!(
        invoke(&view, "cancel_site_crawl", json!({"runId":"cancelled"})).unwrap(),
        Value::Null
    );
    assert!(app
        .handle()
        .state::<CrawlControl>()
        .is_cancelled("cancelled"));
    assert_eq!(
        invoke(&view, "pause_site_crawl", json!({"runId":"cancelled"})).unwrap_err(),
        json!("Cannot pause a cancelled crawl.")
    );
    assert_eq!(
        invoke(&view, "pause_site_crawl", json!({"runId":"paused"})).unwrap(),
        Value::Null
    );
    assert!(app.handle().state::<CrawlControl>().is_paused("paused"));
    assert_eq!(
        invoke(&view, "resume_site_crawl", json!({"runId":"paused"})).unwrap(),
        Value::Null
    );
    assert!(!app.handle().state::<CrawlControl>().is_paused("paused"));
}
