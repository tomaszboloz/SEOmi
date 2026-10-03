use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewWindowBuilder},
    AppHandle,
};

use super::models::{PREVIEW_NEEDLE_MAX_CHARS, PREVIEW_SELECTOR_MAX_CHARS};
use super::navigation::is_allowed_navigation;
use crate::utils::url_validator::validate_and_normalize_url;

pub(crate) fn normalize_preview_value(
    value: &str,
    field: &str,
    max_chars: usize,
) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(format!("{field} cannot be empty."));
    }
    if value.chars().count() > max_chars {
        return Err(format!(
            "{field} exceeds the {max_chars}-character safety limit."
        ));
    }
    if value.chars().any(|character| character == '\0') {
        return Err(format!("{field} contains an invalid null character."));
    }
    Ok(value.to_string())
}

#[tauri::command]
pub async fn open_rendered_element_preview(
    app: AppHandle,
    url: String,
    selector: String,
    needle: Option<String>,
    dom_index: Option<usize>,
    preview_title: String,
    not_found_message: String,
) -> Result<(), String> {
    let target = validate_and_normalize_url(&url).map_err(|error| error.to_string())?;
    let selector =
        normalize_preview_value(&selector, "Preview selector", PREVIEW_SELECTOR_MAX_CHARS)?;
    let needle = needle
        .as_deref()
        .map(|value| normalize_preview_value(value, "Preview match text", PREVIEW_NEEDLE_MAX_CHARS))
        .transpose()?;
    let preview_title = normalize_preview_value(
        &preview_title,
        "Preview window title",
        PREVIEW_SELECTOR_MAX_CHARS,
    )?;
    let not_found_message = normalize_preview_value(
        &not_found_message,
        "Preview not-found message",
        PREVIEW_NEEDLE_MAX_CHARS,
    )?;
    let base_host = target
        .host_str()
        .ok_or_else(|| "Preview URL has no hostname.".to_string())?
        .to_ascii_lowercase();
    let label = format!("audit-preview-{}", uuid::Uuid::new_v4().simple());
    let title = preview_title;
    let selector_json = serde_json::to_string(&selector)
        .map_err(|error| format!("Unable to encode preview selector: {error}"))?;
    let needle_json = serde_json::to_string(&needle)
        .map_err(|error| format!("Unable to encode preview match text: {error}"))?;
    let dom_index_json = serde_json::to_string(&dom_index)
        .map_err(|error| format!("Unable to encode preview DOM index: {error}"))?;
    let not_found_message_json = serde_json::to_string(&not_found_message)
        .map_err(|error| format!("Unable to encode preview not-found message: {error}"))?;
    let preview_script = format!(
        r#"(() => {{
  const selector = {selector_json};
  const needle = {needle_json};
  const domIndex = {dom_index_json};
  const notFoundMessage = {not_found_message_json};
  const candidates = (() => {{ try {{ return Array.from(document.querySelectorAll(selector)); }} catch (_) {{ return []; }} }})();
  const normalized = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const indexedMatch = Number.isInteger(domIndex) && domIndex >= 0 && domIndex < candidates.length
    ? candidates[domIndex]
    : null;
  const match = indexedMatch || (needle
    ? candidates.find((element) => normalized(element.textContent) === normalized(needle)
      || normalized(element.getAttribute('href')) === normalized(needle)
      || normalized(element.getAttribute('src')) === normalized(needle)
      || normalized(element.href) === normalized(needle))
    : candidates[0]);
  const styleId = 'seomi-audit-preview-style';
  document.getElementById(styleId)?.remove();
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = '[data-seomi-audit-preview] {{ outline: 4px solid #34d399 !important; outline-offset: 6px !important; box-shadow: 0 0 0 10px rgba(52,211,153,.18) !important; }}';
  document.head.appendChild(style);
  document.querySelectorAll('[data-seomi-audit-preview]').forEach((element) => element.removeAttribute('data-seomi-audit-preview'));
  if (match) {{
    match.setAttribute('data-seomi-audit-preview', 'true');
    match.scrollIntoView({{ block: 'center', inline: 'nearest', behavior: 'auto' }});
  }} else {{
    const notice = document.createElement('div');
    notice.textContent = notFoundMessage;
    notice.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;max-width:420px;padding:12px 16px;border:1px solid #f59e0b;border-radius:8px;background:#0f172a;color:#fde68a;font:13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)';
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 6000);
  }}
}})();"#
    );
    let (sender, receiver) = tokio::sync::oneshot::channel::<Result<(), String>>();
    let build_app = app.clone();
    let navigation_host = base_host.clone();
    let build_url = target.clone();
    app.run_on_main_thread(move || {
        let result =
            WebviewWindowBuilder::new(&build_app, label, tauri::WebviewUrl::External(build_url))
                .title(title)
                .visible(true)
                .inner_size(1200.0, 800.0)
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .on_navigation(move |navigation_url| {
                    is_allowed_navigation(navigation_url, &navigation_host, false, None)
                })
                .on_page_load(move |window, payload| {
                    if payload.event() == PageLoadEvent::Finished {
                        let _ = window.eval(&preview_script);
                    }
                })
                .build()
                .map(|_| ())
                .map_err(|error| format!("Unable to open rendered element preview: {error}"));
        let _ = sender.send(result);
    })
    .map_err(|error| format!("Unable to schedule rendered element preview: {error}"))?;
    receiver
        .await
        .map_err(|_| "Rendered element preview was interrupted.".to_string())??;
    Ok(())
}
