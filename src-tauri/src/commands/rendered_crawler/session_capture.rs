use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use std::time::Duration;
use tokio::time::timeout;

use super::models::{
    CaptureEvent, CapturedPayload, RenderedArtifactKind, RenderedPageSnapshot, MAX_CAPTURE_CHUNKS,
    MAX_CAPTURE_CHUNK_BYTES, PAGE_RENDER_TIMEOUT,
};
use super::navigation::{is_allowed_navigation, CLEAR_SESSION_SCRIPT};
use super::session::RenderedCrawlerSession;
use crate::utils::url_validator::validate_and_normalize_url;

impl RenderedCrawlerSession {
    pub async fn capture(&mut self, url: &str) -> Result<RenderedPageSnapshot, String> {
        let normalized = validate_and_normalize_url(url).map_err(|error| error.to_string())?;
        if !is_allowed_navigation(
            &normalized,
            &self.base_host,
            self.allow_subdomains,
            self.scope_path.as_deref(),
        ) {
            return Err("The rendered URL is outside the configured crawl scope.".into());
        }

        let requested_url = normalized.to_string();
        if requested_url != self.requested_url {
            self.window
                .navigate(normalized)
                .map_err(|error| format!("Unable to navigate renderer: {error}"))?;
            self.requested_url = requested_url.clone();
        }

        let capture = timeout(PAGE_RENDER_TIMEOUT, self.receive_page_capture())
            .await
            .map_err(|_| "Rendered page capture timed out after 60 seconds.".to_string())??;
        Ok(RenderedPageSnapshot {
            requested_url,
            final_url: capture.page_url,
            http_status: capture.http_status,
            content_type: capture.content_type,
            charset: capture.charset,
            html: capture.html,
            html_truncated: capture.html_truncated,
            navigation_time_ms: capture.navigation_time_ms,
            lcp_ms: capture.lcp_ms,
            inp_ms: capture.inp_ms,
            cls: capture.cls,
            failed_resource_urls: capture.failed_resource_urls,
            console_errors: capture.console_errors,
        })
    }

    pub(crate) async fn capture_artifact(
        &self,
        kind: RenderedArtifactKind,
    ) -> Result<Vec<u8>, String> {
        crate::commands::rendered_artifacts::capture_window_artifact(&self.window, kind).await
    }

    async fn receive_page_capture(&mut self) -> Result<CapturedPayload, String> {
        let sequence = loop {
            match self.receiver.recv().await {
                Some(CaptureEvent::PageReady(sequence)) => break sequence,
                Some(_) => continue,
                None => return Err("Renderer capture channel closed.".into()),
            }
        };

        let mut total_chunks = None;
        let mut chunks: Vec<Option<String>> = Vec::new();
        let mut received = 0usize;
        while received < total_chunks.unwrap_or(usize::MAX) {
            let transfer_timeout = if received == 0 {
                PAGE_RENDER_TIMEOUT
            } else {
                Duration::from_secs(3)
            };
            match timeout(transfer_timeout, self.receiver.recv())
                .await
                .map_err(|_| "Renderer capture transfer stalled.".to_string())?
            {
                Some(CaptureEvent::PageReady(next_sequence)) if next_sequence > sequence => {
                    return Err(
                        "The page navigated again before its rendered snapshot completed.".into(),
                    );
                }
                Some(CaptureEvent::TransferFailed(failed_sequence))
                    if failed_sequence == sequence =>
                {
                    return Err("Renderer capture transfer failed after bounded retries.".into());
                }
                Some(CaptureEvent::Chunk(chunk)) if chunk.sequence == sequence => {
                    if chunk.total == 0
                        || chunk.total > MAX_CAPTURE_CHUNKS
                        || chunk.index >= chunk.total
                        || chunk.data.len() > MAX_CAPTURE_CHUNK_BYTES
                    {
                        return Err("Renderer returned an invalid capture chunk.".into());
                    }
                    if total_chunks.is_some_and(|total| total != chunk.total) {
                        return Err(
                            "Renderer capture chunks disagree about the total count.".into()
                        );
                    }
                    if total_chunks.is_none() {
                        total_chunks = Some(chunk.total);
                        chunks.resize(chunk.total, None);
                    }
                    let acknowledgement = format!(
                        "window.dispatchEvent(new CustomEvent('seomi-capture-ack', {{detail: {{nonce: {}, sequence: {}, index: {}}}}}));",
                        serde_json::to_string(&self.nonce).map_err(|error| error.to_string())?, sequence, chunk.index
                    );
                    if chunks[chunk.index].is_none() {
                        chunks[chunk.index] = Some(chunk.data);
                        received += 1;
                    }
                    self.window.eval(&acknowledgement).map_err(|error| {
                        format!("Unable to acknowledge renderer capture: {error}")
                    })?;
                }
                Some(_) => continue,
                None => return Err("Renderer capture channel closed before completion.".into()),
            }
        }

        let encoded = chunks
            .into_iter()
            .map(|chunk| chunk.ok_or_else(|| "Renderer snapshot is missing a chunk.".to_string()))
            .collect::<Result<String, _>>()?;
        let bytes = URL_SAFE_NO_PAD
            .decode(encoded)
            .map_err(|_| "Renderer snapshot is not valid base64url.".to_string())?;
        serde_json::from_slice(&bytes)
            .map_err(|error| format!("Renderer returned invalid snapshot JSON: {error}"))
    }

    pub fn close(mut self) {
        let _ = self.window.eval(CLEAR_SESSION_SCRIPT);
        let _ = self.window.close();
        self.proxy.take();
    }
}
