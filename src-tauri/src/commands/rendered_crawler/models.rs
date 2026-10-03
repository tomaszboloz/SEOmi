use std::time::Duration;
use serde::{Deserialize, Serialize};

pub const CAPTURE_SCHEME: &str = "seomi-capture";
pub const MAX_CAPTURE_HTML_CHARS: usize = 1_000_000;
pub const MAX_CAPTURE_CHUNK_BYTES: usize = 12_000;
pub const MAX_CAPTURE_CHUNKS: usize = 768;
pub const MAX_CAPTURE_CHANNEL_EVENTS: usize = (MAX_CAPTURE_CHUNKS * 2) + 32;
pub const PAGE_RENDER_TIMEOUT: Duration = Duration::from_secs(60);
pub const NETWORK_IDLE_MAX_WAIT_MS: u64 = 5_000;
pub const NETWORK_IDLE_QUIET_MS: u64 = 500;
pub const NETWORK_IDLE_POLL_MS: u64 = 100;
pub const DOM_IDLE_MAX_WAIT_MS: u64 = 5_000;
pub const DOM_IDLE_QUIET_MS: u64 = 500;
pub const PREVIEW_SELECTOR_MAX_CHARS: usize = 512;
pub const PREVIEW_NEEDLE_MAX_CHARS: usize = 2_048;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedPageSnapshot {
    pub requested_url: String,
    pub final_url: String,
    pub http_status: Option<u16>,
    pub content_type: String,
    pub charset: String,
    pub html: String,
    pub html_truncated: bool,
    pub navigation_time_ms: Option<u64>,
    pub lcp_ms: Option<u64>,
    pub inp_ms: Option<u64>,
    pub cls: Option<f64>,
    pub failed_resource_urls: Vec<String>,
    pub console_errors: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RenderedArtifactKind {
    Screenshot,
    Pdf,
}

impl RenderedArtifactKind {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        match value.trim().to_ascii_lowercase().as_str() {
            "screenshot" | "png" => Ok(Self::Screenshot),
            "pdf" => Ok(Self::Pdf),
            _ => Err("Rendered artifact kind must be screenshot or pdf.".into()),
        }
    }

    pub(crate) fn content_type(self) -> &'static str {
        match self {
            Self::Screenshot => "image/png",
            Self::Pdf => "application/pdf",
        }
    }

    pub(crate) fn extension(self) -> &'static str {
        match self {
            Self::Screenshot => "png",
            Self::Pdf => "pdf",
        }
    }

    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Screenshot => "screenshot",
            Self::Pdf => "pdf",
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct RenderOptions {
    pub user_agent: Option<String>,
    pub cookie: Option<String>,
    pub wait_for_selector: Option<String>,
    pub wait_delay_ms: u64,
    pub lazy_scroll_cycles: usize,
}

#[derive(Debug, Deserialize)]
pub(crate) struct CapturedPayload {
    pub page_url: String,
    pub http_status: Option<u16>,
    pub content_type: String,
    pub charset: String,
    pub html: String,
    pub html_truncated: bool,
    pub navigation_time_ms: Option<u64>,
    pub lcp_ms: Option<u64>,
    pub inp_ms: Option<u64>,
    pub cls: Option<f64>,
    pub failed_resource_urls: Vec<String>,
    pub console_errors: Vec<String>,
}

#[derive(Debug)]
pub(crate) enum CaptureEvent {
    PageReady(u64),
    Chunk(CaptureChunk),
    TransferFailed(u64),
}

#[derive(Debug)]
pub(crate) struct CaptureChunk {
    pub sequence: u64,
    pub index: usize,
    pub total: usize,
    pub data: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedPageArtifact {
    pub requested_url: String,
    pub final_url: String,
    pub run_id: Option<String>,
    pub captured_at: String,
    pub artifact_type: String,
    pub content_type: String,
    pub file_name: String,
    pub bytes: usize,
    pub data_base64: String,
    pub renderer_platform: String,
}
