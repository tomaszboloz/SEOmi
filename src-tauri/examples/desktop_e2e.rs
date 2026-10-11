//! An actual desktop runtime, sharing production plugins, state and IPC.
//! Test JavaScript exists only in this example; it is never bundled into SEOmi.
use std::{fs, path::PathBuf, sync::Mutex, time::Duration};
use tauri::{Listener, Manager};
use uuid::Uuid;

// 26 renderer checks plus 11 live-page checks for each of HTTP and browser-rendered modes.
const REQUIRED_RENDERER_CHECKS: usize = 26 + (11 * 2);
// Validation includes 39 base, 24 additional and 126 malformed IPC checks.
// Keep this explicit so adding a script without extending the gate fails.
const REQUIRED_VALIDATION_CHECKS: usize = 39 + 24 + 126;

fn main() {
    let report = PathBuf::from(std::env::args_os().nth(1).expect("report path argument"));
    let renderer_enabled = std::env::var("SEOMI_E2E_RENDERER").ok().as_deref() == Some("1");
    let session = Uuid::new_v4();
    let mut context = tauri::generate_context!();
    context.config_mut().plugins.0.insert(
        "updater".into(),
        serde_json::json!({ "pubkey": "", "endpoints": [] }),
    );
    context.config_mut().identifier = format!("com.seomi.desktop.e2e.{}", session.simple());
    context.config_mut().product_name = Some("SEOmi Desktop E2E".into());
    let profile = std::env::temp_dir().join(format!("seomi-e2e-webview-{session}"));
    let mut window = context.config().app.windows[0].clone();
    window.title = "SEOmi Desktop E2E".into();
    // Tauri's WindowConfig -> WebviewAttributes conversion does not propagate
    // the macOS data-store identifier. Set isolation on the builder explicitly.
    context.config_mut().app.windows.clear();
    let profile_for_setup = profile.clone();
    let roots = std::sync::Arc::new(Mutex::new(Vec::<PathBuf>::new()));
    let roots_for_setup = roots.clone();
    let script = include_str!("desktop_e2e.js");
    let renderer_script = include_str!("desktop_e2e_renderer.js");
    let validation_script = include_str!("desktop_e2e_validation.js");
    let additional_validation_script = include_str!("desktop_e2e_additional.js");
    let crawl_validation_script = include_str!("desktop_e2e_crawl.js");
    let ipc_validation_script = include_str!("desktop_e2e_ipc.js");
    let main_script = format!(
        "window.__seomiE2eRendererEnabled = {renderer_enabled};\n{ipc_validation_script}\n{additional_validation_script}\n{validation_script}\n{crawl_validation_script}\n{renderer_script}\n{script}"
    );
    let plugin = tauri::plugin::Builder::<tauri::Wry, ()>::new("desktop-e2e")
        .setup(move |app, _| {
            eprintln!("desktop-e2e: listener setup");
            for path in [app.path().app_data_dir()?, app.path().app_config_dir()?] {
                assert!(path.to_string_lossy().contains("com.seomi.desktop.e2e."));
                roots_for_setup.lock().unwrap().push(path);
            }
            let handle = app.clone();
            let report_path = report.clone();
            app.listen("seomi-desktop-e2e-result", move |event| {
                let mut data: serde_json::Value = serde_json::from_str(event.payload()).unwrap();
                let renderer = data.get("renderer");
                let renderer_status = renderer.and_then(|value| value.get("status"));
                let renderer_checks = renderer
                    .and_then(|value| value.get("checks"))
                    .and_then(serde_json::Value::as_array);
                let renderer_passed = renderer
                    .and_then(|value| value.get("passed"))
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(false);
                let renderer_valid = if renderer_enabled {
                    renderer_status.and_then(serde_json::Value::as_str) == Some("executed")
                        && renderer_passed
                        && renderer_checks
                            .is_some_and(|checks| checks.len() >= REQUIRED_RENDERER_CHECKS)
                        && renderer
                            .and_then(|value| value.get("previewEvidence"))
                            .and_then(serde_json::Value::as_str)
                            == Some("ipc-success")
                } else {
                    renderer_status.and_then(serde_json::Value::as_str) == Some("skipped")
                        && renderer_passed
                        && renderer.and_then(|value| value.get("reason")).is_some()
                };
                let validation = data.get("validation");
                let validation_valid = validation
                    .and_then(|value| value.get("status"))
                    .and_then(serde_json::Value::as_str)
                    == Some("executed")
                    && validation
                        .and_then(|value| value.get("passed"))
                        .and_then(serde_json::Value::as_bool)
                        .unwrap_or(false)
                    && validation
                        .and_then(|value| value.get("checks"))
                        .and_then(serde_json::Value::as_array)
                        .is_some_and(|checks| checks.len() == REQUIRED_VALIDATION_CHECKS);
                let passed = data["passed"] == true
                    && data["checks"]
                        .as_array()
                        .is_some_and(|checks| checks.len() >= 24)
                    && validation_valid
                    && renderer_valid;
                data["passed"] = passed.into();
                fs::write(&report_path, serde_json::to_vec_pretty(&data).unwrap()).unwrap();
                handle.exit(if passed { 0 } else { 1 });
            });
            let handle = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(if renderer_enabled { 210 } else { 90 }));
                handle.exit(2);
            });
            Ok(())
        })
        .on_page_load(move |webview, payload| {
            eprintln!("desktop-e2e: page load {:?}", payload.event());
            if payload.event() == tauri::webview::PageLoadEvent::Finished
                && webview.label() == "main"
            {
                webview
                    .eval(&main_script)
                    .expect("inject desktop E2E fixture");
            }
        })
        .build();
    seomi_lib::utils::logging::init();
    let code = seomi_lib::desktop_builder()
        .plugin(plugin)
        .build(context)
        .expect("build actual desktop runtime")
        .run_return(move |app, event| {
            if matches!(event, tauri::RunEvent::Ready) {
                eprintln!("desktop-e2e: event loop ready");
                tauri::WebviewWindowBuilder::from_config(app, &window)
                    .expect("test window config")
                    .data_directory(profile_for_setup.clone())
                    .data_store_identifier(*session.as_bytes())
                    .build()
                    .expect("create isolated E2E WebView on the running event loop");
                eprintln!("desktop-e2e: isolated window built");
            }
        });
    for root in roots.lock().unwrap().iter() {
        let _ = fs::remove_dir_all(root);
    }
    let _ = fs::remove_dir_all(&profile);
    std::process::exit(code);
}

#[cfg(test)]
#[path = "desktop_e2e_contract_tests.rs"]
mod contract_tests;
