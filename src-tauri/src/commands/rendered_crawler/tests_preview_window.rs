use super::preview_window::{
    build_window, inject_after_load, navigation_guard, open_preview_window,
    schedule_on_main_thread, PreviewWindow,
};
use crate::utils::test_app::StorageApp;
use tauri::{test::mock_builder, webview::PageLoadEvent, Manager, WebviewWindowBuilder};
use url::Url;

fn spec(label: &str) -> PreviewWindow {
    PreviewWindow {
        label: label.into(),
        title: "Preview".into(),
        url: Url::parse("https://example.test/").unwrap(),
        host: "example.test".into(),
        script: "1".into(),
    }
}

#[test]
fn navigation_guard_keeps_the_preview_on_its_host() {
    let guard = navigation_guard("example.test".into());
    assert!(guard(&Url::parse("https://example.test/a").unwrap()));
    assert!(!guard(&Url::parse("https://other.test/a").unwrap()));
}

#[test]
fn building_the_same_label_twice_reports_the_open_failure() {
    let app = StorageApp::new(mock_builder());
    build_window(&app.handle(), spec("preview-dup")).unwrap();
    let error = build_window(&app.handle(), spec("preview-dup")).unwrap_err();
    assert!(error.starts_with("Unable to open rendered element preview: "));
}

#[test]
fn script_injection_runs_only_for_finished_loads() {
    let app = StorageApp::new(mock_builder());
    let window = WebviewWindowBuilder::new(
        &app.handle(),
        "inject",
        tauri::WebviewUrl::External("https://example.test/".parse().unwrap()),
    )
    .build()
    .unwrap();
    inject_after_load(&window, PageLoadEvent::Started, "1");
    inject_after_load(&window, PageLoadEvent::Finished, "1");
    assert!(app.handle().get_webview_window("inject").is_some());
}

#[tokio::test]
async fn scheduling_and_interruption_failures_are_reported() {
    let app = StorageApp::new(mock_builder());
    let handle = app.handle();
    let scheduled = open_preview_window(&handle, spec("sched"), |_, _| {
        Err(tauri::Error::FailedToReceiveMessage)
    })
    .await;
    assert!(scheduled
        .unwrap_err()
        .starts_with("Unable to schedule rendered element preview: "));
    let dropped = open_preview_window(&handle, spec("drop"), |_, task| {
        drop(task);
        Ok(())
    })
    .await;
    assert_eq!(
        dropped.unwrap_err(),
        "Rendered element preview was interrupted."
    );
    open_preview_window(&handle, spec("ok"), schedule_on_main_thread)
        .await
        .unwrap();
}
