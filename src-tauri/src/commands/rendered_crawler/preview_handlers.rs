use super::navigation::is_allowed_navigation;
use tauri::webview::PageLoadEvent;

pub(crate) fn handle_preview_navigation(navigation_url: &url::Url, navigation_host: &str) -> bool {
    is_allowed_navigation(navigation_url, navigation_host, false, None)
}

pub(crate) fn handle_preview_page_load(event: PageLoadEvent, eval: impl FnOnce()) {
    if event == PageLoadEvent::Finished {
        eval();
    }
}
