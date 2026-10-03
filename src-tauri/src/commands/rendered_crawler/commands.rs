use base64::Engine as _;
use tauri::AppHandle;

use super::models::{
    RenderOptions, RenderedArtifactKind, RenderedPageArtifact, RenderedPageSnapshot,
};
use super::session::RenderedCrawlerSession;
use crate::utils::url_validator::validate_and_normalize_url;

#[tauri::command]
pub async fn render_crawl_page(
    app: AppHandle,
    url: String,
    allow_subdomains: bool,
    scope_path: Option<String>,
    wait_for_selector: Option<String>,
    wait_delay_ms: Option<u64>,
    lazy_scroll_cycles: Option<usize>,
) -> Result<RenderedPageSnapshot, String> {
    let target = validate_and_normalize_url(&url).map_err(|error| error.to_string())?;
    let base_host = target
        .host_str()
        .ok_or_else(|| "Rendered URL has no hostname.".to_string())?
        .to_ascii_lowercase();
    let options = RenderOptions {
        user_agent: None,
        cookie: None,
        wait_for_selector: wait_for_selector
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty()),
        wait_delay_ms: wait_delay_ms.unwrap_or(0).min(10_000),
        lazy_scroll_cycles: lazy_scroll_cycles.unwrap_or(0).min(40),
    };
    let mut session = RenderedCrawlerSession::open(
        &app,
        target.as_str(),
        &base_host,
        allow_subdomains,
        scope_path.as_deref(),
        options,
    )
    .await?;
    let result = session.capture(target.as_str()).await;
    session.close();
    result
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn capture_rendered_artifact(
    app: AppHandle,
    url: String,
    allow_subdomains: bool,
    scope_path: Option<String>,
    wait_for_selector: Option<String>,
    wait_delay_ms: Option<u64>,
    lazy_scroll_cycles: Option<usize>,
    kind: String,
    run_id: Option<String>,
) -> Result<RenderedPageArtifact, String> {
    let target = validate_and_normalize_url(&url).map_err(|error| error.to_string())?;
    let artifact_kind = RenderedArtifactKind::parse(&kind)?;
    let base_host = target
        .host_str()
        .ok_or_else(|| "Rendered URL has no hostname.".to_string())?
        .to_ascii_lowercase();
    let options = RenderOptions {
        user_agent: None,
        cookie: None,
        wait_for_selector: wait_for_selector
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty()),
        wait_delay_ms: wait_delay_ms.unwrap_or(0).min(10_000),
        lazy_scroll_cycles: lazy_scroll_cycles.unwrap_or(0).min(40),
    };
    let mut session = RenderedCrawlerSession::open(
        &app,
        target.as_str(),
        &base_host,
        allow_subdomains,
        scope_path.as_deref(),
        options,
    )
    .await?;
    let snapshot = session.capture(target.as_str()).await;
    let result = match snapshot {
        Ok(snapshot) => match session.capture_artifact(artifact_kind).await {
            Ok(bytes) => {
                let captured_at = chrono::Utc::now().to_rfc3339();
                let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
                Ok(RenderedPageArtifact {
                    requested_url: snapshot.requested_url,
                    final_url: snapshot.final_url,
                    run_id: run_id
                        .map(|value| value.trim().chars().take(128).collect())
                        .filter(|value: &String| !value.is_empty()),
                    captured_at,
                    artifact_type: artifact_kind.label().to_string(),
                    content_type: artifact_kind.content_type().to_string(),
                    file_name: format!(
                        "rendered-page-{timestamp}-{}.{}",
                        artifact_kind.label(),
                        artifact_kind.extension()
                    ),
                    bytes: bytes.len(),
                    data_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
                    renderer_platform: crate::commands::rendered_artifacts::renderer_platform()
                        .to_string(),
                })
            }
            Err(error) => Err(error),
        },
        Err(error) => Err(error),
    };
    session.close();
    result
}
