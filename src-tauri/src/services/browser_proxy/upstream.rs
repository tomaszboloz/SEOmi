use super::types::*;
use crate::utils::url_validator::is_public_ip;
use std::future::Future;
use std::io;
use std::net::{IpAddr, SocketAddr};
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::net::{lookup_host, TcpStream};
use tokio::time::timeout;
use url::Url;

pub(super) async fn connect_to_public_host(host: &str, port: u16) -> io::Result<TcpStream> {
    connect_to_public_host_with(
        host,
        port,
        |host, port| async move {
            let addresses = lookup_host((host.as_str(), port)).await?;
            Ok(addresses.collect::<Vec<_>>())
        },
        TcpStream::connect,
        CONNECT_TIMEOUT,
    )
    .await
}

pub(super) async fn connect_to_public_host_with<R, RFut, C, CFut>(
    host: &str,
    port: u16,
    resolve: R,
    connect: C,
    connect_timeout: Duration,
) -> io::Result<TcpStream>
where
    R: Fn(String, u16) -> RFut,
    RFut: Future<Output = io::Result<Vec<SocketAddr>>>,
    C: Fn(SocketAddr) -> CFut,
    CFut: Future<Output = io::Result<TcpStream>>,
{
    let normalized_host = host
        .strip_prefix('[')
        .and_then(|v| v.strip_suffix(']'))
        .unwrap_or(host);
    if is_local_hostname(normalized_host) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "local hostname blocked",
        ));
    }
    let destinations = if let Ok(ip) = normalized_host.parse::<IpAddr>() {
        vec![SocketAddr::new(ip, port)]
    } else {
        resolve(normalized_host.to_owned(), port).await?
    };
    let public = destinations
        .into_iter()
        .find(|addr| is_public_ip(&addr.ip()))
        .ok_or_else(|| io::Error::new(io::ErrorKind::PermissionDenied, "no public DNS result"))?;
    timeout(connect_timeout, connect(public))
        .await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "upstream connect timed out"))?
}

pub(super) fn is_local_hostname(host: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".internal")
        || host.ends_with(".lan")
        || host == "metadata.google.internal"
}

pub(super) fn request_target(url: &Url) -> String {
    let mut target = url.path().to_owned();
    if target.is_empty() {
        target.push('/');
    }
    if let Some(query) = url.query() {
        target.push('?');
        target.push_str(query);
    }
    target
}

pub(super) fn authority_for(url: &Url) -> String {
    match url.port() {
        Some(port) => format!("{}:{port}", url.host_str().unwrap_or_default()),
        None => url.host_str().unwrap_or_default().to_owned(),
    }
}

pub(super) async fn reject(mut stream: TcpStream, status: u16, message: &str) {
    let body = message.as_bytes();
    let response = format!(
        "HTTP/1.1 {status} {}\r\nConnection: close\r\nContent-Length: {}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n",
        reason_phrase(status),
        body.len()
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.write_all(body).await;
    let _ = stream.shutdown().await;
}

pub(super) fn reason_phrase(status: u16) -> &'static str {
    match status {
        400 => "Bad Request",
        403 => "Forbidden",
        405 => "Method Not Allowed",
        408 => "Request Timeout",
        413 => "Payload Too Large",
        431 => "Request Header Fields Too Large",
        502 => "Bad Gateway",
        503 => "Service Unavailable",
        _ => "Error",
    }
}
