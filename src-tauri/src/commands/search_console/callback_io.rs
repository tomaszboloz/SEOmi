use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    time::{timeout, Duration},
};

const MAX_CALLBACK_HEADER_BYTES: usize = 16 * 1024;

pub(super) async fn read_callback_request(
    stream: &mut TcpStream,
    deadline: Duration,
) -> Result<String, String> {
    timeout(deadline, async {
        let mut request = Vec::new();
        let mut chunk = [0u8; 4096];
        loop {
            let capacity = (MAX_CALLBACK_HEADER_BYTES + 1 - request.len()).min(chunk.len());
            let count = stream
                .read(&mut chunk[..capacity])
                .await
                .map_err(|error| format!("Unable to read the OAuth response: {error}"))?;
            if count == 0 {
                return Err("Incomplete OAuth callback request.".into());
            }
            request.extend_from_slice(&chunk[..count]);
            if let Some(end) = request.windows(4).position(|bytes| bytes == b"\r\n\r\n") {
                if end + 4 > MAX_CALLBACK_HEADER_BYTES {
                    return Err("OAuth callback headers exceed the limit.".into());
                }
                return String::from_utf8(request[..end + 4].to_vec())
                    .map_err(|_| "Invalid OAuth callback encoding.".into());
            }
            if request.len() >= MAX_CALLBACK_HEADER_BYTES {
                return Err("OAuth callback headers exceed the limit.".into());
            }
        }
    })
    .await
    .map_err(|_| "OAuth callback request timed out.".to_string())?
}

pub(super) async fn write_callback_response(
    stream: &mut tokio::net::TcpStream,
    status: &str,
    message: &str,
) -> Result<(), String> {
    let body =
        format!("<!doctype html><meta charset=\"utf-8\"><title>SEOmi</title><p>{message}</p>");
    let response = format!("HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n{body}", body.len());
    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|error| format!("Unable to complete the OAuth callback: {error}"))
}
