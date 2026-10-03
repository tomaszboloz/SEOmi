use super::models::*;
use crate::utils::http_syntax::is_http_token_byte;
use std::{collections::HashMap, sync::Arc};
use tokio::{
    io::{AsyncRead, AsyncReadExt},
    sync::Mutex,
};

pub(super) async fn bearer_matches(
    authorization: Option<&str>,
    token: &Arc<Mutex<Option<String>>>,
) -> bool {
    let Some(authorization) = authorization else {
        return false;
    };
    let Some(candidate) = authorization.strip_prefix("Bearer ") else {
        return false;
    };
    let mut expected = token.lock().await;
    if expected.as_deref() != Some(candidate) {
        return false;
    }
    expected.take();
    true
}

pub(super) async fn read_request<R: AsyncRead + Unpin>(
    stream: &mut R,
) -> Result<HttpRequest, String> {
    let mut bytes = Vec::with_capacity(8 * 1024);
    let header_end = loop {
        if let Some(index) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
            break index;
        }
        if bytes.len() >= MAX_HEADER_BYTES {
            return Err("Worker request headers exceed the safety limit.".into());
        }
        let mut chunk = [0u8; 4096];
        let read = stream
            .read(&mut chunk)
            .await
            .map_err(|error| error.to_string())?;
        if read == 0 {
            return Err("Worker request ended before headers were complete.".into());
        }
        bytes.extend_from_slice(&chunk[..read]);
    };
    let header_length = header_end + 4;
    if header_length > MAX_HEADER_BYTES {
        return Err("Worker request headers exceed the safety limit.".into());
    }
    let header_text = std::str::from_utf8(&bytes[..header_end])
        .map_err(|_| "Worker request headers are not UTF-8.".to_string())?;
    let mut lines = header_text.split("\r\n");
    let request_line = lines
        .next()
        .ok_or_else(|| "Worker request line is missing.".to_string())?;
    let mut request_parts = request_line.split_ascii_whitespace();
    let method = request_parts.next().unwrap_or_default().to_string();
    let path = request_parts.next().unwrap_or_default().to_string();
    let version = request_parts.next();
    if !matches!(version, Some("HTTP/1.0" | "HTTP/1.1"))
        || request_parts.next().is_some()
        || method.is_empty()
        || method.len() > 16
        || !method.bytes().all(is_http_token_byte)
        || path.is_empty()
        || path.len() > 2048
        || path.bytes().any(|byte| byte.is_ascii_control())
    {
        return Err("Worker request line is invalid.".into());
    }
    let mut headers = HashMap::new();
    for line in lines {
        let (name, value) = line
            .split_once(':')
            .ok_or_else(|| "Worker request header is invalid.".to_string())?;
        if !name.bytes().all(is_http_token_byte)
            || value
                .bytes()
                .any(|byte| (byte < b' ' && byte != b'\t') || byte == 0x7f)
        {
            return Err("Worker request header is invalid.".into());
        }
        let name = name.to_ascii_lowercase();
        let value = value.trim().to_string();
        if name.is_empty() || headers.insert(name.clone(), value).is_some() {
            return Err("Worker request contains duplicate or empty headers.".into());
        }
    }
    if headers.contains_key("transfer-encoding") {
        return Err("Chunked worker requests are not supported.".into());
    }
    let content_length = headers
        .get("content-length")
        .map(|value| {
            value
                .parse::<usize>()
                .map_err(|_| "Worker content-length is invalid.".to_string())
        })
        .transpose()?
        .unwrap_or(0);
    if content_length > MAX_BODY_BYTES || header_length + content_length > MAX_REQUEST_BYTES {
        return Err("Worker request body exceeds the safety limit.".into());
    }
    while bytes.len() < header_length + content_length {
        let mut chunk = [0u8; 4096];
        let read = stream
            .read(&mut chunk)
            .await
            .map_err(|error| error.to_string())?;
        if read == 0 {
            return Err("Worker request ended before the body was complete.".into());
        }
        bytes.extend_from_slice(&chunk[..read]);
    }
    Ok(HttpRequest {
        method,
        path,
        headers,
        body: bytes[header_length..header_length + content_length].to_vec(),
    })
}

pub(super) use super::http_response::{json_error, write_response};
