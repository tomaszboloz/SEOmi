use super::models::*;
use crate::commands::rendered_crawler::{
    RenderOptions, RenderedCrawlerSession, RenderedPageSnapshot,
};
use crate::utils::url_validator::validate_and_normalize_url;
use tauri::AppHandle;

pub(super) async fn render_request(
    app: &AppHandle,
    request: RenderWorkerRequest,
) -> Result<RenderedPageSnapshot, String> {
    let target = validate_and_normalize_url(&request.url).map_err(|error| error.to_string())?;
    let base_host = target
        .host_str()
        .ok_or_else(|| "Rendered URL has no hostname.".to_string())?
        .to_ascii_lowercase();
    let scope_path = normalize_scope_path(request.scope_path.as_deref())?;
    let wait_for_selector = request
        .wait_for_selector
        .as_deref()
        .map(|value| normalize_bounded_text(value, "waitForSelector", 512))
        .transpose()?;
    let options = RenderOptions {
        user_agent: None,
        cookie: None,
        wait_for_selector,
        wait_delay_ms: request.wait_delay_ms.min(10_000),
        lazy_scroll_cycles: request.lazy_scroll_cycles.min(40),
    };
    let mut session = RenderedCrawlerSession::open(
        app,
        target.as_str(),
        &base_host,
        request.allow_subdomains,
        scope_path.as_deref(),
        options,
    )
    .await?;
    let result = session.capture(target.as_str()).await;
    session.close();
    result
}

pub(super) fn normalize_scope_path(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let value = normalize_bounded_text(value, "scopePath", MAX_SCOPE_PATH_CHARS)?;
    if !value.starts_with('/') || value.contains('\0') {
        return Err("scopePath must be an absolute URL path without null characters.".into());
    }
    Ok(Some(value.trim_end_matches('/').to_string()))
}

pub(super) fn normalize_bounded_text(
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
    if value.chars().any(|c| c == '\0') {
        return Err(format!("{field} contains an invalid null character."));
    }
    Ok(value.to_string())
}
