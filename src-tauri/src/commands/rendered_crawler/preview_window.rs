use super::preview_handlers::{handle_preview_navigation, handle_preview_page_load};
use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewWindowBuilder},
    AppHandle, Runtime, WebviewWindow,
};
use url::Url;

pub(crate) struct PreviewWindow {
    pub label: String,
    pub title: String,
    pub url: Url,
    pub host: String,
    pub script: String,
}

type MainThreadTask = Box<dyn FnOnce() + Send + 'static>;

pub(crate) fn schedule_on_main_thread<R: Runtime>(
    app: &AppHandle<R>,
    task: MainThreadTask,
) -> tauri::Result<()> {
    app.run_on_main_thread(task)
}

pub(crate) fn navigation_guard(host: String) -> impl Fn(&Url) -> bool + Send + Sync + 'static {
    move |url| handle_preview_navigation(url, &host)
}

pub(crate) fn inject_after_load<R: Runtime>(
    window: &WebviewWindow<R>,
    event: PageLoadEvent,
    script: &str,
) {
    handle_preview_page_load(event, || {
        let _ = window.eval(script);
    });
}

pub(crate) fn build_window<R: Runtime>(
    app: &AppHandle<R>,
    spec: PreviewWindow,
) -> Result<(), String> {
    let PreviewWindow {
        label,
        title,
        url,
        host,
        script,
    } = spec;
    WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::External(url))
        .title(title)
        .visible(true)
        .inner_size(1200.0, 800.0)
        .on_new_window(|_, _| NewWindowResponse::Deny)
        .on_navigation(navigation_guard(host))
        .on_page_load(move |window, payload| inject_after_load(&window, payload.event(), &script))
        .build()
        .map(|_| ())
        .map_err(|error| format!("Unable to open rendered element preview: {error}"))
}

pub(crate) async fn open_preview_window<R: Runtime>(
    app: &AppHandle<R>,
    spec: PreviewWindow,
    schedule: impl FnOnce(&AppHandle<R>, MainThreadTask) -> tauri::Result<()>,
) -> Result<(), String> {
    let (sender, receiver) = tokio::sync::oneshot::channel::<Result<(), String>>();
    let build_app = app.clone();
    schedule(
        app,
        Box::new(move || {
            let _ = sender.send(build_window(&build_app, spec));
        }),
    )
    .map_err(|error| format!("Unable to schedule rendered element preview: {error}"))?;
    receiver
        .await
        .map_err(|_| "Rendered element preview was interrupted.".to_string())??;
    Ok(())
}
