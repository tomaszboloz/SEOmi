use super::*;
use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::{test::mock_builder, Manager, WebviewWindowBuilder};

fn fixture(control: CrawlControl) -> StorageApp {
    StorageApp::new(
        mock_builder()
            .manage(control)
            .invoke_handler(tauri::generate_handler![cancel_site_crawl]),
    )
}

fn view(app: &StorageApp) -> tauri::WebviewWindow<tauri::test::MockRuntime> {
    WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap()
}

#[test]
fn cancel_command_reports_poisoned_state() {
    let app = fixture(CrawlControl::new());
    let handle = app.handle();
    let state = handle.state::<CrawlControl>();
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _guard = state.cancelled_runs.lock().unwrap();
        panic!("poison");
    }));
    let view = view(&app);
    assert_eq!(
        invoke(&view, "cancel_site_crawl", json!({"runId": "x"})).unwrap_err(),
        json!("Crawler cancellation state is unavailable.")
    );
}
