use super::models::MAX_BODY_BYTES;
use anyhow::{anyhow, Result};

pub async fn read_bounded_bytes(mut response: reqwest::Response, limit: usize) -> Result<Vec<u8>> {
    let limit = limit.min(MAX_BODY_BYTES);
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        if chunk.len() > limit.saturating_sub(bytes.len()) {
            return Err(anyhow!(
                "Response size exceeds safety limit of {limit} bytes"
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

pub async fn read_bounded_text(response: reqwest::Response, limit: usize) -> Result<String> {
    let bytes = read_bounded_bytes(response, limit).await?;
    Ok(String::from_utf8_lossy(&bytes).to_string())
}
