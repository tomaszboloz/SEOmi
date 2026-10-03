use std::{collections::HashMap, sync::Arc};
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, net::TcpStream, sync::Mutex};
use super::models::*;

pub(super) async fn bearer_matches(authorization: Option<&str>, token: &Arc<Mutex<Option<String>>>) -> bool {
    let Some(authorization) = authorization else { return false; };
    let Some(candidate) = authorization.strip_prefix("Bearer ") else { return false; };
    let mut expected = token.lock().await;
    if expected.as_deref() != Some(candidate) { return false; }
    expected.take();
    true
}

pub(super) async fn read_request(stream: &mut TcpStream) -> Result<HttpRequest, String> {
    let mut bytes = Vec::with_capacity(8 * 1024);
    let header_end = loop {
        if let Some(index) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
            break index;
        }
        if bytes.len() >= MAX_HEADER_BYTES {
            return Err("Worker request headers exceed the safety limit.".into());
        }
        let mut chunk = [0u8; 4096];
        let read = stream.read(&mut chunk).await.map_err(|error| error.to_string())?;
        if read == 0 {
            return Err("Worker request ended before headers were complete.".into());
        }
        bytes.extend_from_slice(&chunk[..read]);
    };
    let header_length = header_end + 4;
    let header_text = std::str::from_utf8(&bytes[..header_end])
        .map_err(|_| "Worker request headers are not UTF-8.".to_string())?;
    let mut lines = header_text.split("\r\n");
    let request_line = lines.next().ok_or_else(|| "Worker request line is missing.".to_string())?;
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().unwrap_or_default().to_string();
    let path = request_parts.next().unwrap_or_default().to_string();
    if request_parts.next().is_none() || method.len() > 16 || path.len() > 2048 {
        return Err("Worker request line is invalid.".into());
    }
    let mut headers = HashMap::new();
    for line in lines {
        let (name, value) = line.split_once(':').ok_or_else(|| "Worker request header is invalid.".to_string())?;
        let name = name.trim().to_ascii_lowercase();
        let value = value.trim().to_string();
        if name.is_empty() || headers.insert(name.clone(), value).is_some() {
            return Err("Worker request contains duplicate or empty headers.".into());
        }
    }
    if headers.contains_key("transfer-encoding") {
        return Err("Chunked worker requests are not supported.".into());
    }
    let content_length = headers.get("content-length")
        .map(|value| value.parse::<usize>().map_err(|_| "Worker content-length is invalid.".to_string()))
        .transpose()?
        .unwrap_or(0);
    if content_length > MAX_BODY_BYTES || header_length + content_length > MAX_REQUEST_BYTES {
        return Err("Worker request body exceeds the safety limit.".into());
    }
    while bytes.len() < header_length + content_length {
        let mut chunk = [0u8; 4096];
        let read = stream.read(&mut chunk).await.map_err(|error| error.to_string())?;
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

pub(super) fn json_error(message: &str) -> Vec<u8> {
    serde_json::to_vec(&ErrorResponse {
        error: message.to_string(),
    })
    .unwrap_or_else(|_| b"{\"error\":\"worker error\"}".to_vec())
}

pub(super) async fn write_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &[u8],
) -> Result<(), String> {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        410 => "Gone",
        413 => "Payload Too Large",
        415 => "Unsupported Media Type",
        422 => "Unprocessable Entity",
        426 => "Upgrade Required",
        _ => "Error",
    };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(header.as_bytes()).await.map_err(|error| error.to_string())?;
    stream.write_all(body).await.map_err(|error| error.to_string())?;
    let _ = stream.shutdown().await;
    Ok(())
}
