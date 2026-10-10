use super::models::{ErrorResponse, WorkerShared, RENDER_WORKER_VERSION};
use tauri::Runtime;
use tokio::{
    io::{AsyncWrite, AsyncWriteExt},
    time::Instant,
};

pub(super) fn json_error(message: &str) -> Vec<u8> {
    serde_json::to_vec(&ErrorResponse {
        error: message.to_string(),
    })
    .unwrap_or_else(|_| b"{\"error\":\"worker error\"}".to_vec())
}

pub(super) fn health_response<R: Runtime>(
    shared: &WorkerShared<R>,
) -> Result<(u16, &'static str, Vec<u8>), String> {
    let expired = Instant::now() >= shared.expires_at;
    let body = serde_json::json!({
        "ok": !expired,
        "version": RENDER_WORKER_VERSION,
        "renderer": crate::commands::rendered_artifacts::renderer_platform(),
        "expiresAt": shared.expires_at_text,
        "expiresInSeconds": shared.expires_at.saturating_duration_since(Instant::now()).as_secs(),
    });
    Ok((
        if expired { 410 } else { 200 },
        "application/json",
        serde_json::to_vec(&body).map_err(|error| error.to_string())?,
    ))
}

pub(super) fn format_render_snapshot(
    snapshot: &crate::commands::rendered_crawler::RenderedPageSnapshot,
) -> Result<(u16, &'static str, Vec<u8>), String> {
    let body = serde_json::to_vec(snapshot).map_err(|error| error.to_string())?;
    Ok(if body.len() > 8 * 1024 * 1024 {
        (
            413,
            "application/json",
            json_error("Rendered snapshot exceeds the response safety limit."),
        )
    } else {
        (200, "application/json", body)
    })
}

pub(super) async fn write_response<W: AsyncWrite + Unpin>(
    stream: &mut W,
    status: u16,
    content_type: &str,
    body: &[u8],
) -> Result<(), String> {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        410 => "Gone",
        413 => "Payload Too Large",
        415 => "Unsupported Media Type",
        422 => "Unprocessable Entity",
        426 => "Upgrade Required",
        _ => "Error",
    };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream
        .write_all(header.as_bytes())
        .await
        .map_err(|error| error.to_string())?;
    stream
        .write_all(body)
        .await
        .map_err(|error| error.to_string())?;
    let _ = stream.shutdown().await;
    Ok(())
}
