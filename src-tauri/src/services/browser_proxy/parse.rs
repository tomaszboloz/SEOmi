pub(super) use super::target::parse_proxy_target;
use super::types::*;
use tokio::io::{AsyncRead, AsyncReadExt};

pub(super) fn find_header_end(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

pub(super) async fn read_request<R: AsyncRead + Unpin>(
    client: &mut R,
) -> Result<ParsedRequest, u16> {
    let mut bytes = Vec::with_capacity(8 * 1024);
    let header_end = loop {
        if let Some(index) = find_header_end(&bytes) {
            break index;
        }
        if bytes.len() >= MAX_HEADER_BYTES {
            return Err(431);
        }
        let mut chunk = [0_u8; 4096];
        let read = client.read(&mut chunk).await.map_err(|_| 400_u16)?;
        if read == 0 {
            return Err(400);
        }
        bytes.extend_from_slice(&chunk[..read]);
    };
    if header_end + 4 > MAX_HEADER_BYTES {
        return Err(431);
    }
    let header = std::str::from_utf8(&bytes[..header_end]).map_err(|_| 400_u16)?;
    let parsed_head = parse_request_head(header)?;
    let RequestHead {
        method,
        target,
        headers,
        content_length,
    } = parsed_head;
    let body_start = header_end + 4;
    let mut body = bytes[body_start..].to_vec();
    if body.len() > content_length {
        return Err(400);
    }
    while body.len() < content_length {
        let remaining = content_length - body.len();
        let mut chunk = vec![0_u8; remaining.min(16 * 1024)];
        let read = client.read(&mut chunk).await.map_err(|_| 400_u16)?;
        if read == 0 {
            return Err(400);
        }
        body.extend_from_slice(&chunk[..read]);
    }
    let parsed_target = parse_proxy_target(method, target, headers, content_length, &body)?;
    Ok(ParsedRequest {
        target: parsed_target,
        body,
    })
}

pub(super) fn parse_request_head(header: &str) -> Result<RequestHead, u16> {
    let mut lines = header.split("\r\n");
    let request_line = lines.next().ok_or(400_u16)?;
    let mut request_parts = request_line.split_ascii_whitespace();
    let method = request_parts.next().ok_or(400_u16)?;
    let target = request_parts.next().ok_or(400_u16)?;
    let version = request_parts.next().ok_or(400_u16)?;
    if request_parts.next().is_some()
        || !matches!(version, "HTTP/1.0" | "HTTP/1.1")
        || !method.bytes().all(is_http_token_byte)
        || target.bytes().any(|b| b.is_ascii_control() || b == b' ')
    {
        return Err(400);
    }
    if !method.eq_ignore_ascii_case("GET")
        && !method.eq_ignore_ascii_case("HEAD")
        && !method.eq_ignore_ascii_case("CONNECT")
    {
        return Err(405);
    }
    let mut headers = Vec::new();
    let mut content_length = None;
    for line in lines {
        if line.is_empty() {
            continue;
        }
        let (name, value) = line.split_once(':').ok_or(400_u16)?;
        if name.is_empty()
            || !name.bytes().all(is_http_token_byte)
            || value.bytes().any(|b| (b < b' ' && b != b'\t') || b == 0x7f)
        {
            return Err(400);
        }
        let name = name.trim();
        let value = value.trim();
        match name.to_ascii_lowercase().as_str() {
            "transfer-encoding" | "expect" => return Err(400),
            "content-length" => {
                if content_length.is_some() {
                    return Err(400);
                }
                content_length = Some(value.parse::<usize>().map_err(|_| 400_u16)?);
            }
            _ => {}
        }
        headers.push((name.to_owned(), value.to_owned()));
    }
    let content_length = content_length.unwrap_or(0);
    if content_length > MAX_REQUEST_BODY_BYTES {
        return Err(413);
    }
    Ok(RequestHead {
        method: method.to_owned(),
        target: target.to_owned(),
        headers,
        content_length,
    })
}
