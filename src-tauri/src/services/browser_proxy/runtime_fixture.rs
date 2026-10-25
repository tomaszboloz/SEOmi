use super::BrowserRequestProxy;
use std::time::Duration;
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    time::timeout,
};

pub(super) fn is_complete_http_response(bytes: &[u8]) -> bool {
    let Some(header_end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") else {
        return false;
    };
    let body_start = header_end + 4;
    let headers_part = &bytes[..header_end];
    for line in headers_part.split(|&b| b == b'\n') {
        let line = if line.ends_with(b"\r") {
            &line[..line.len() - 1]
        } else {
            line
        };
        if let Some(pos) = line.iter().position(|&b| b == b':') {
            if line[..pos].eq_ignore_ascii_case(b"content-length") {
                let value_str = std::str::from_utf8(&line[pos + 1..]).unwrap_or("").trim();
                if let Ok(expected_len) = value_str.parse::<usize>() {
                    return bytes[body_start..].len() >= expected_len;
                }
            }
        }
    }
    false
}

pub(super) async fn read_response<R: AsyncRead + Unpin>(mut stream: R) -> std::io::Result<Vec<u8>> {
    let mut response = Vec::new();
    let mut buf = [0u8; 512];
    loop {
        if is_complete_http_response(&response) {
            break;
        }
        match stream.read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => response.extend_from_slice(&buf[..n]),
            Err(e) if e.kind() == std::io::ErrorKind::ConnectionReset => {
                if is_complete_http_response(&response) {
                    break;
                } else {
                    return Err(e);
                }
            }
            Err(e) => return Err(e),
        }
    }
    if !is_complete_http_response(&response) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::UnexpectedEof,
            "incomplete HTTP response",
        ));
    }
    Ok(response)
}

pub(super) async fn request(proxy: &BrowserRequestProxy, request_bytes: &[u8]) -> Vec<u8> {
    let mut stream = TcpStream::connect(proxy.address).await.unwrap();
    if !request_bytes.is_empty() {
        stream.write_all(request_bytes).await.unwrap();
    }
    stream.shutdown().await.unwrap();
    timeout(Duration::from_secs(5), read_response(&mut stream))
        .await
        .unwrap()
        .unwrap()
}
