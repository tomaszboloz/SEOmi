use super::models::{PREVIEW_NEEDLE_MAX_CHARS, PREVIEW_SELECTOR_MAX_CHARS};
use super::preview_window::{open_preview_window, schedule_on_main_thread, PreviewWindow};
use crate::utils::url_validator::validate_and_normalize_url;
use tauri::{AppHandle, Runtime};

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
pub async fn open_rendered_element_preview<R: Runtime>(
    app: AppHandle<R>,
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
        .expect("validated preview URLs always carry a host")
        .to_ascii_lowercase();
    let script = build_preview_script(&selector, needle.as_deref(), dom_index, &not_found_message);
    let spec = PreviewWindow {
        label: format!("audit-preview-{}", uuid::Uuid::new_v4().simple()),
        title: preview_title,
        url: target,
        host: base_host,
        script,
    };
    open_preview_window(&app, spec, schedule_on_main_thread).await
}

/// Builds the browser-side preview script from JSON literals. `String`,
/// `Option<String>` and `Option<usize>` have infallible serde representations;
/// the `expect` calls document that invariant while preserving JSON escaping.
pub(crate) fn build_preview_script(
    selector: &str,
    needle: Option<&str>,
    dom_index: Option<usize>,
    not_found_message: &str,
) -> String {
    let selector_json = serde_json::to_string(selector)
        .expect("preview selector string is always JSON serializable");
    let needle_json =
        serde_json::to_string(&needle).expect("preview match text is always JSON serializable");
    let dom_index_json =
        serde_json::to_string(&dom_index).expect("preview DOM index is always JSON serializable");
    let not_found_message_json = serde_json::to_string(not_found_message)
        .expect("preview not-found message is always JSON serializable");
    format!(
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
    )
}
