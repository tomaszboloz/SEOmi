//! An actual desktop runtime, sharing production plugins, state and IPC.
//! Test JavaScript exists only in this example; it is never bundled into SEOmi.
use std::{fs, path::PathBuf, sync::Mutex, time::Duration};
use tauri::{Listener, Manager};
use uuid::Uuid;

fn main() {
    let report = PathBuf::from(std::env::args_os().nth(1).expect("report path argument"));
    let session = Uuid::new_v4();
    let mut context = tauri::generate_context!();
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
                let data: serde_json::Value = serde_json::from_str(event.payload()).unwrap();
                let passed = data["passed"] == true
                    && data["checks"]
                        .as_array()
                        .is_some_and(|checks| checks.len() >= 24);
                fs::write(&report_path, serde_json::to_vec_pretty(&data).unwrap()).unwrap();
                handle.exit(if passed { 0 } else { 1 });
            });
            let handle = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(90));
                handle.exit(2);
            });
            Ok(())
        })
        .on_page_load(move |webview, payload| {
            eprintln!("desktop-e2e: page load {:?}", payload.event());
            if payload.event() == tauri::webview::PageLoadEvent::Finished {
                webview.eval(script).expect("inject desktop E2E fixture");
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
