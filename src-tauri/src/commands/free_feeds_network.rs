use super::{PublicFeedResponse, MAX_PUBLIC_FEED_BYTES};
use chrono::Utc;
use reqwest::{Client, StatusCode};
use url::Url;

fn feed_response(
    status: &str,
    url: &Url,
    fetched_at: String,
    http_status: Option<u16>,
    body: Option<String>,
    error: Option<String>,
) -> PublicFeedResponse {
    PublicFeedResponse {
        status: status.into(),
        source_url: url.to_string(),
        fetched_at,
        body,
        http_status,
        error,
    }
}

pub(super) async fn bounded_body(
    mut response: reqwest::Response,
    max_bytes: usize,
) -> Result<String, &'static str> {
    if response
        .content_length()
        .is_some_and(|length| length > max_bytes as u64)
    {
        return Err("Public feed body exceeds the byte limit.");
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Public feed body could not be read.")?
    {
        if body.len().saturating_add(chunk.len()) > max_bytes {
            return Err("Public feed body exceeds the byte limit.");
        }
        body.extend_from_slice(&chunk);
    }
    String::from_utf8(body).map_err(|_| "Public feed body is not valid UTF-8.")
}

pub(super) async fn fetch_public_feed_at(client: &Client, url: Url) -> PublicFeedResponse {
    let fetched_at = Utc::now().to_rfc3339();
    let response = match client
        .get(url.clone())
        .header("Accept", "application/rss+xml, application/xml, text/xml")
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => {
            return feed_response(
                "error",
                &url,
                fetched_at,
                None,
                None,
                Some("Public feed request failed.".into()),
            )
        }
    };
    let status = response.status();
    if status == StatusCode::FORBIDDEN || status == StatusCode::TOO_MANY_REQUESTS {
        return feed_response(
            "blocked",
            &url,
            fetched_at,
            Some(status.as_u16()),
            None,
            Some(format!(
                "Public feed blocked by upstream (HTTP {}).",
                status.as_u16()
            )),
        );
    }
    if status.is_redirection() {
        return feed_response(
            "error",
            &url,
            fetched_at,
            Some(status.as_u16()),
            None,
            Some("Public feed redirects are prohibited.".into()),
        );
    }
    if !status.is_success() {
        return feed_response(
            "error",
            &url,
            fetched_at,
            Some(status.as_u16()),
            None,
            Some(format!(
                "Public feed request failed (HTTP {}).",
                status.as_u16()
            )),
        );
    }
    match bounded_body(response, MAX_PUBLIC_FEED_BYTES).await {
        Ok(body) => feed_response(
            "ok",
            &url,
            fetched_at,
            Some(status.as_u16()),
            Some(body),
            None,
        ),
        Err(error) => feed_response(
            "error",
            &url,
            fetched_at,
            Some(status.as_u16()),
            None,
            Some(error.into()),
        ),
    }
}
