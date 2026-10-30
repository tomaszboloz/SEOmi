//! Valid-argument calls through the composed (shipped) handler table, so the
//! generated wrapper closures of commands with fast local failures run.

use crate::utils::test_app::{invoke, StorageApp};
use serde_json::json;
use tauri::test::mock_builder;

#[tokio::test]
async fn composed_render_worker_commands_manage_the_worker_lifecycle() {
    let fixture = StorageApp::new(crate::compose(mock_builder()));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    assert_eq!(
        invoke(&view, "render_worker_status", json!({})).unwrap(),
        json!(false)
    );
    let lease = invoke(&view, "start_render_worker", json!({})).unwrap();
    assert!(lease["baseUrl"]
        .as_str()
        .unwrap()
        .starts_with("http://127.0.0.1:"));
    assert_eq!(
        invoke(&view, "render_worker_status", json!({})).unwrap(),
        json!(true)
    );
    invoke(&view, "stop_render_worker", json!({})).unwrap();
    assert_eq!(
        invoke(&view, "render_worker_status", json!({})).unwrap(),
        json!(false)
    );
}

#[tokio::test]
async fn composed_commands_with_invalid_input_fail_before_any_window_or_network_work() {
    let fixture = StorageApp::new(crate::compose(mock_builder()));
    let view = tauri::WebviewWindowBuilder::new(&fixture.app, "main", Default::default())
        .build()
        .unwrap();
    let render = json!({
        "url": "", "allowSubdomains": false, "scopePath": null, "waitForSelector": null,
        "waitDelayMs": null, "lazyScrollCycles": null
    });
    assert!(invoke(&view, "render_crawl_page", render.clone()).is_err());
    let mut artifact = render;
    artifact["kind"] = json!("png");
    artifact["runId"] = json!(null);
    assert!(invoke(&view, "capture_rendered_artifact", artifact).is_err());
    assert!(invoke(&view, "discover_mcp_tools", json!({ "serverPath": "" })).is_err());
    let crawl = json!({
        "startUrl": "", "maxPages": null, "userAgent": null, "runId": null,
        "projectId": null, "config": null
    });
    assert!(invoke(&view, "crawl_site", crawl).is_err());
    for (command, args) in [
        (
            "connect_google_analytics",
            json!({"projectId": "p", "clientId": "bad", "clientSecret": null}),
        ),
        (
            "list_google_analytics_properties",
            json!({"projectId": "p", "clientId": "c", "siteUrl": ""}),
        ),
        (
            "google_analytics_performance",
            json!({"projectId": "p", "clientId": "c", "siteUrl": "", "startDate": null, "endDate": null}),
        ),
    ] {
        assert!(invoke(&view, command, args).is_err(), "{command}");
    }
}

#[test]
#[allow(deprecated)]
fn composed_app_runs_its_interactive_setup_hook() {
    let mut app = crate::compose(mock_builder())
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .unwrap();
    app.run_iteration(|_, _| {});
}
