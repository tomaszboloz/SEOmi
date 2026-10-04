use super::{
    models::ExternalLinkCheck,
    network::{error_kind, normalize_external_url, rejected},
};
use reqwest::header::{LOCATION, RANGE};
use std::{future::Future, net::SocketAddr, time::Instant};
use url::Url;

pub(super) async fn check_with<R, F, B>(input: String, resolve: R, build: B) -> ExternalLinkCheck
where
    R: FnOnce(Url) -> F,
    F: Future<Output = Result<Vec<SocketAddr>, String>>,
    B: FnOnce(&Url, &[SocketAddr]) -> Result<reqwest::Client, String>,
{
    let url = match normalize_external_url(&input) {
        Ok(url) => url,
        Err(error) => {
            let kind = if error.contains("local/private") || error.contains("local network") {
                "blocked"
            } else {
                "invalid"
            };
            return rejected(input, kind);
        }
    };
    let normalized = url.to_string();
    let addresses = match resolve(url.clone()).await {
        Ok(addresses) => addresses,
        Err(error) if error.starts_with("DNS lookup failed") => return rejected(normalized, "dns"),
        Err(error) if error.contains("timed out") => return rejected(normalized, "timeout"),
        Err(_) => return rejected(normalized, "blocked"),
    };
    let client = match build(&url, &addresses) {
        Ok(client) => client,
        Err(_) => return rejected(normalized, "network"),
    };

    let started = Instant::now();
    let response = match client.head(url.clone()).send().await {
        Ok(response) if response.status().as_u16() == 405 || response.status().as_u16() == 501 => {
            let request = client.get(url.clone()).header(RANGE, "bytes=0-0");
            match request.send().await {
                Ok(response) => response,
                Err(error) => return rejected(normalized, error_kind(&error)),
            }
        }
        Ok(response) => response,
        Err(error) => return rejected(normalized, error_kind(&error)),
    };
    let elapsed = started.elapsed().as_millis() as u64;
    let status = response.status().as_u16();
    let redirect_url = response
        .headers()
        .get(LOCATION)
        .and_then(|location| location.to_str().ok())
        .and_then(|location| url.join(location).ok())
        .map(|target| target.to_string());
    ExternalLinkCheck {
        url: normalized,
        http_status: Some(status),
        response_time_ms: Some(elapsed),
        redirect_url,
        request_error_kind: None,
        checked_at: chrono::Utc::now().to_rfc3339(),
    }
}
