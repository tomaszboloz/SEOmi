use super::{
    concurrency::{gate_for, HostGates},
    models::ExternalLinkCheck,
    network::{error_kind, normalize_external_url},
    result::{failed, observed, record_redirect, redirect_failure, ChainState},
};
use crate::utils::url_validator::validate_and_normalize_url;
use reqwest::header::{LOCATION, RANGE};
use std::{collections::HashSet, future::Future, net::SocketAddr, time::Instant};
use url::Url;

const MAX_REDIRECTS: usize = 8;

fn should_fallback_to_get(status: u16) -> bool {
    matches!(status, 403 | 404 | 405 | 429 | 501) || status >= 500
}

fn is_redirect(status: u16) -> bool {
    matches!(status, 301 | 302 | 303 | 307 | 308)
}

pub(super) async fn run<R, F, B>(
    input: String,
    mut resolve: R,
    mut build: B,
    gates: Option<HostGates>,
    state: ChainState,
) -> ExternalLinkCheck
where
    R: FnMut(Url) -> F,
    F: Future<Output = Result<Vec<SocketAddr>, String>>,
    B: FnMut(&Url, &[SocketAddr]) -> Result<reqwest::Client, String>,
{
    let url = match normalize_external_url(&input) {
        Ok(url) => url,
        Err(error) => {
            let kind = if error.contains("local/private") || error.contains("local network") {
                "blocked"
            } else {
                "invalid"
            };
            return failed(input, None, kind);
        }
    };
    let normalized = url.to_string();
    let mut current = url;
    let mut redirect_url = None;
    let mut seen = HashSet::from([normalized.clone()]);
    let mut redirects = 0;
    let started = Instant::now();
    loop {
        let permit = match gates.as_ref() {
            Some(gates) => Some(
                gate_for(current.as_str(), gates)
                    .acquire_owned()
                    .await
                    .unwrap(),
            ),
            None => None,
        };
        let addresses = match resolve(current.clone()).await {
            Ok(addresses) => addresses,
            Err(error) if error.starts_with("DNS lookup failed") => {
                return failed(normalized, redirect_url, "dns")
            }
            Err(error) if error.contains("timed out") => {
                return failed(normalized, redirect_url, "timeout")
            }
            Err(_) => return failed(normalized, redirect_url, "blocked"),
        };
        let client = match build(&current, &addresses) {
            Ok(client) => client,
            Err(_) => return failed(normalized, redirect_url, "network"),
        };
        let mut response = match client.head(current.clone()).send().await {
            Ok(response) => response,
            Err(error) => return failed(normalized, redirect_url, error_kind(&error)),
        };
        if should_fallback_to_get(response.status().as_u16()) {
            response = match client
                .get(current.clone())
                .header(RANGE, "bytes=0-0")
                .send()
                .await
            {
                Ok(response) => response,
                Err(error) => return failed(normalized, redirect_url, error_kind(&error)),
            };
        }
        let status = response.status().as_u16();
        if !is_redirect(status) {
            return observed(
                normalized,
                status,
                started.elapsed().as_millis() as u64,
                redirect_url,
                None,
            );
        }
        let Some(location) = response
            .headers()
            .get(LOCATION)
            .and_then(|value| value.to_str().ok())
        else {
            return redirect_failure(normalized, status, started, redirect_url);
        };
        let Some(next) = current
            .join(location)
            .ok()
            .and_then(|target| validate_and_normalize_url(target.as_str()).ok())
        else {
            return redirect_failure(normalized, status, started, redirect_url);
        };
        let next_url = next.to_string();
        record_redirect(&state, &next_url);
        redirect_url = Some(next_url.clone());
        redirects += 1;
        if redirects > MAX_REDIRECTS || !seen.insert(next_url) {
            return redirect_failure(normalized, status, started, redirect_url);
        }
        drop(permit);
        current = next;
    }
}
