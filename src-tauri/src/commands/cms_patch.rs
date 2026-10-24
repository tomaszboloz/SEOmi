use crate::commands::settings::secret_entry;
use crate::services::http_client::public_client_builder;
use crate::utils::url_validator::validate_and_normalize_url;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, time::Duration};

const MAX_BYTES: usize = 4 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CmsRequest {
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    credential: String,
    follow_redirects: bool,
    timeout_ms: u64,
}

#[derive(Serialize)]
pub struct CmsResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: String,
}

fn validate(request: &CmsRequest) -> Result<url::Url, String> {
    let url = validate_and_normalize_url(&request.url).map_err(|_| "Unsafe CMS URL")?;
    if !request.url.starts_with("https://") || url.scheme() != "https" {
        return Err("CMS URL must use HTTPS".into());
    }
    if request.follow_redirects || !matches!(request.method.as_str(), "GET" | "POST" | "PUT") {
        return Err("Unsupported CMS request".into());
    }
    if request
        .body
        .as_ref()
        .is_some_and(|body| body.len() > MAX_BYTES)
        || request
            .headers
            .keys()
            .any(|name| !matches!(name.as_str(), "Accept" | "Content-Type" | "If-Match"))
    {
        return Err("Unsupported CMS payload or headers".into());
    }
    if !request.credential.is_empty() && !request.credential.starts_with("cms_auth_") {
        return Err("CMS credential names must start with cms_auth_".into());
    }
    Ok(url)
}

#[tauri::command]
pub async fn cms_patch_request(request: CmsRequest) -> Result<CmsResponse, String> {
    let url = validate(&request)?;
    let client = public_client_builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_millis(request.timeout_ms.clamp(1, 15_000)))
        .build()
        .map_err(|_| "Unable to create CMS client")?;
    let method =
        reqwest::Method::from_bytes(request.method.as_bytes()).map_err(|_| "Invalid CMS method")?;
    let mut outgoing = client.request(method, url);
    for (name, value) in request.headers {
        outgoing = outgoing.header(name, value);
    }
    if !request.credential.is_empty() {
        let secret = secret_entry(&request.credential)?
            .get_password()
            .map_err(|_| "CMS credential unavailable")?;
        let mut value = reqwest::header::HeaderValue::from_str(&secret)
            .map_err(|_| "CMS credential is not a valid header value")?;
        value.set_sensitive(true);
        outgoing = outgoing.header(reqwest::header::AUTHORIZATION, value);
    }
    if let Some(body) = request.body {
        outgoing = outgoing.body(body);
    }
    let mut response = outgoing.send().await.map_err(|_| "CMS request failed")?;
    let status = response.status().as_u16();
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Unable to read CMS response")?
    {
        if bytes.len() + chunk.len() > MAX_BYTES {
            return Err("CMS response is too large".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let body = String::from_utf8(bytes).map_err(|_| "Invalid CMS response encoding")?;
    Ok(CmsResponse {
        status,
        headers: HashMap::new(),
        body,
    })
}

#[cfg(test)]
#[path = "../../../tests/nativeCmsPatch.rs"]
mod tests;
