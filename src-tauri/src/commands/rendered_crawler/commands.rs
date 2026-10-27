use base64::Engine as _;
use tauri::{AppHandle, Runtime};

use super::models::{
    RenderOptions, RenderedArtifactKind, RenderedPageArtifact, RenderedPageSnapshot,
};
use super::session::RenderedCrawlerSession;
use crate::utils::url_validator::validate_and_normalize_url;

fn render_options(
    wait_for_selector: Option<String>,
    wait_delay_ms: Option<u64>,
    lazy_scroll_cycles: Option<usize>,
) -> RenderOptions {
    RenderOptions {
        user_agent: None,
        cookie: None,
        wait_for_selector: wait_for_selector
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty()),
        wait_delay_ms: wait_delay_ms.unwrap_or(0).min(10_000),
        lazy_scroll_cycles: lazy_scroll_cycles.unwrap_or(0).min(40),
        allowed_hosts: Vec::new(),
    }
}

fn host_of(target: &url::Url) -> String {
    // `validate_and_normalize_url` only returns web URLs with a hostname.
    target
        .host_str()
        .expect("validated rendered URL must have a hostname")
        .to_ascii_lowercase()
}

pub(super) async fn render_with_session<R: Runtime>(
    mut session: RenderedCrawlerSession<R>,
    url: &str,
) -> Result<RenderedPageSnapshot, String> {
    let result = session.capture(url).await;
    session.close_and_wait().await;
    result
}

pub(super) async fn artifact_with_session<R: Runtime>(
    mut session: RenderedCrawlerSession<R>,
    url: &str,
    kind: RenderedArtifactKind,
    run_id: Option<String>,
) -> Result<RenderedPageArtifact, String> {
    let snapshot = session.capture(url).await;
    let bytes = if snapshot.is_ok() {
        session.capture_artifact(kind).await
    } else {
        Err(String::new())
    };
    session.close_and_wait().await;
    finish_artifact(snapshot, bytes, kind, run_id)
}

pub(super) fn finish_artifact(
    snapshot: Result<RenderedPageSnapshot, String>,
    bytes: Result<Vec<u8>, String>,
    kind: RenderedArtifactKind,
    run_id: Option<String>,
) -> Result<RenderedPageArtifact, String> {
    match (snapshot, bytes) {
        (Ok(snapshot), Ok(bytes)) => Ok(build_artifact(snapshot, kind, run_id, &bytes)),
        (Err(error), _) | (Ok(_), Err(error)) => Err(error),
    }
}

pub(super) fn build_artifact(
    snapshot: RenderedPageSnapshot,
    kind: RenderedArtifactKind,
    run_id: Option<String>,
    bytes: &[u8],
) -> RenderedPageArtifact {
    let captured_at = chrono::Utc::now().to_rfc3339();
    let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
    RenderedPageArtifact {
        requested_url: snapshot.requested_url,
        final_url: snapshot.final_url,
        run_id: run_id
            .map(|value| value.trim().chars().take(128).collect())
            .filter(|value: &String| !value.is_empty()),
        captured_at,
        artifact_type: kind.label().to_string(),
        content_type: kind.content_type().to_string(),
        file_name: format!(
            "rendered-page-{timestamp}-{}.{}",
            kind.label(),
            kind.extension()
        ),
        bytes: bytes.len(),
        data_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
        renderer_platform: crate::commands::rendered_artifacts::renderer_platform().to_string(),
    }
}

#[tauri::command]
pub async fn render_crawl_page<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    allow_subdomains: bool,
    scope_path: Option<String>,
    wait_for_selector: Option<String>,
    wait_delay_ms: Option<u64>,
    lazy_scroll_cycles: Option<usize>,
) -> Result<RenderedPageSnapshot, String> {
    let target = validate_and_normalize_url(&url).map_err(|error| error.to_string())?;
    let session = RenderedCrawlerSession::open(
        &app,
        target.as_str(),
        &host_of(&target),
        allow_subdomains,
        scope_path.as_deref(),
        render_options(wait_for_selector, wait_delay_ms, lazy_scroll_cycles),
    )
    .await?;
    render_with_session(session, target.as_str()).await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn capture_rendered_artifact<R: Runtime>(
    app: AppHandle<R>,
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
    let session = RenderedCrawlerSession::open(
        &app,
        target.as_str(),
        &host_of(&target),
        allow_subdomains,
        scope_path.as_deref(),
        render_options(wait_for_selector, wait_delay_ms, lazy_scroll_cycles),
    )
    .await?;
    artifact_with_session(session, target.as_str(), artifact_kind, run_id).await
}
