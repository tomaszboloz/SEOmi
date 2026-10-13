use reqwest::{redirect::Policy, Client};
use serde_json::Value;
use std::time::Duration;

const RDAP_BOOTSTRAP_URL: &str = "https://rdap.org";
const MAX_RDAP_BYTES: usize = 1_048_576;
const RDAP_TIMEOUT_SECS: u64 = 10;
const MAX_RDAP_REDIRECTS: usize = 3;

fn valid_label(label: &str) -> bool {
    !label.is_empty()
        && label.len() <= 63
        && !label.starts_with('-')
        && !label.ends_with('-')
        && label
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

fn registrable_hostname(domain: &str) -> Result<String, String> {
    let host = domain.trim().trim_end_matches('.').to_ascii_lowercase();
    let labels: Vec<&str> = host.split('.').collect();
    let numeric_tld = labels
        .last()
        .is_some_and(|tld| tld.bytes().all(|b| b.is_ascii_digit()));
    if host.len() > 253 || labels.len() < 2 || numeric_tld || !labels.iter().all(|l| valid_label(l))
    {
        return Err("Invalid domain name.".into());
    }
    Ok(host)
}

fn may_follow(previous_hops: usize, scheme: &str) -> bool {
    previous_hops < MAX_RDAP_REDIRECTS && scheme == "https"
}

fn rdap_client() -> Result<Client, String> {
    let policy = Policy::custom(|attempt| {
        if may_follow(attempt.previous().len(), attempt.url().scheme()) {
            attempt.follow()
        } else {
            attempt.stop()
        }
    });
    Client::builder()
        .timeout(Duration::from_secs(RDAP_TIMEOUT_SECS))
        .redirect(policy)
        .build()
        .map_err(|_| "Unable to create RDAP client.".to_string())
}

async fn bounded_json(mut response: reqwest::Response) -> Result<Value, String> {
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RDAP_BYTES as u64)
    {
        return Err("RDAP response exceeds byte limit.".into());
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "RDAP response could not be read.")?
    {
        if body.len().saturating_add(chunk.len()) > MAX_RDAP_BYTES {
            return Err("RDAP response exceeds byte limit.".into());
        }
        body.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&body).map_err(|_| "RDAP response is not valid JSON.".to_string())
}

async fn rdap_lookup_at(client: &Client, base: &str, domain: &str) -> Result<Value, String> {
    let host = registrable_hostname(domain)?;
    let response = client
        .get(format!("{base}/domain/{host}"))
        .header("Accept", "application/rdap+json, application/json")
        .send()
        .await
        .map_err(|_| "RDAP request failed.".to_string())?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("HTTP {}", status.as_u16()));
    }
    bounded_json(response).await
}

#[tauri::command]
pub async fn rdap_domain_lookup(domain: String) -> Result<Value, String> {
    rdap_lookup_at(&rdap_client()?, RDAP_BOOTSTRAP_URL, &domain).await
}

#[cfg(test)]
#[path = "rdap_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "rdap_stream_tests.rs"]
mod stream_tests;
