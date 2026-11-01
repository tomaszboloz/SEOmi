use super::stream::read_bounded_bytes;
use crate::utils::url_validator::validate_and_normalize_url;
use anyhow::{anyhow, bail, Result};
use reqwest::redirect::Policy;
use std::future::Future;
use std::net::SocketAddr;
use std::time::Duration;
use url::Url;

pub const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;
const MAX_REDIRECTS: usize = 5;

#[derive(Debug, Clone)]
pub struct ImageBytes {
    pub final_url: String,
    pub content_type: String,
    pub bytes: Vec<u8>,
}

fn content_type(response: &reqwest::Response) -> String {
    response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
}

/// Raster-only: SVG can carry script, so it is refused like in the browser source.
fn is_raster_image(kind: &str) -> bool {
    kind.starts_with("image/") && kind != "image/svg+xml"
}

/// Bounded native image download. Every hop is re-validated and pinned to resolver-approved
/// addresses (no DNS rebinding, no private hosts); cookies and proxies are never used.
pub async fn fetch_image_with_resolver<R, F>(
    target: &Url,
    timeout: Duration,
    resolve: R,
) -> Result<ImageBytes>
where
    R: Fn(Url) -> F,
    F: Future<Output = Result<Vec<SocketAddr>>>,
{
    tokio::time::timeout(timeout, async {
        let mut current = validate_and_normalize_url(target.as_str())
            .map_err(|error| anyhow!(error.to_string()))?;
        let mut hops = 0;
        loop {
            let addresses = resolve(current.clone()).await?;
            let host = current.host_str().expect("validated URL has a host");
            let client = reqwest::Client::builder()
                .redirect(Policy::none())
                .no_proxy()
                .resolve_to_addrs(host, &addresses)
                .build()?;
            let response = client
                .get(current.clone())
                .header("Accept", "image/*")
                .send()
                .await?;
            let status = response.status();
            if status.is_redirection() {
                let location = response
                    .headers()
                    .get(reqwest::header::LOCATION)
                    .ok_or_else(|| anyhow!("Redirect without location"))?;
                hops += 1;
                if hops > MAX_REDIRECTS {
                    bail!("Too many redirects");
                }
                let next = current.join(location.to_str()?)?;
                current = validate_and_normalize_url(next.as_str())
                    .map_err(|error| anyhow!("Unsafe redirect blocked: {error}"))?;
                continue;
            }
            if !status.is_success() {
                bail!("HTTP {}", status.as_u16());
            }
            let kind = content_type(&response);
            if !is_raster_image(&kind) {
                bail!("Not a raster image");
            }
            let bytes = read_bounded_bytes(response, MAX_IMAGE_BYTES).await?;
            return Ok(ImageBytes {
                final_url: current.to_string(),
                content_type: kind,
                bytes,
            });
        }
    })
    .await
    .map_err(|_| anyhow!("Image download timed out"))?
}

#[cfg(test)]
#[path = "tests_image.rs"]
mod tests;
