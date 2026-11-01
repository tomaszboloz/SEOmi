use crate::services::http_client::image::{fetch_image_with_resolver, ImageBytes};
use crate::services::http_client::resolver::resolve_public_addresses;
use base64::Engine;
use serde::Serialize;
use std::time::Duration;
use url::Url;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDownload {
    pub final_url: String,
    pub content_type: String,
    pub base64: String,
}

fn to_download(image: ImageBytes) -> ImageDownload {
    ImageDownload {
        final_url: image.final_url,
        content_type: image.content_type,
        base64: base64::engine::general_purpose::STANDARD.encode(image.bytes),
    }
}

/// Native image download for hosts that do not send CORS headers (#96). Public hosts only,
/// raster only, at most 5 MB, no cookies; the WebView never sees credentials or private networks.
#[tauri::command]
pub async fn fetch_image_bytes(url: String) -> Result<ImageDownload, String> {
    let target = Url::parse(&url).map_err(|_| "Invalid image URL".to_string())?;
    fetch_image_with_resolver(&target, Duration::from_secs(15), |hop| async move {
        resolve_public_addresses(&hop).await
    })
    .await
    .map(to_download)
    .map_err(|error| format!("Image download failed: {error}"))
}

#[cfg(test)]
#[path = "image_fetch_tests.rs"]
mod tests;
