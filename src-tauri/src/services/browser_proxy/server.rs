use super::parse::*;
use super::types::*;
use super::upstream::*;
use std::{future::Future, time::Duration};
use tokio::io::{AsyncRead, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

pub(super) async fn serve_connection(client: TcpStream) {
    serve_connection_with(
        client,
        |host, port| async move { connect_to_public_host(&host, port).await },
        REQUEST_TIMEOUT,
        TUNNEL_TIMEOUT,
    )
    .await;
}

pub(super) async fn serve_connection_with<F, Fut>(
    client: TcpStream,
    connect: F,
    request_timeout: Duration,
    tunnel_timeout: Duration,
) where
    F: Fn(String, u16) -> Fut,
    Fut: Future<Output = std::io::Result<TcpStream>>,
{
    serve_streams(client, connect, request_timeout, tunnel_timeout).await;
}

pub(super) async fn serve_streams<C, U, F, Fut>(
    mut client: C,
    connect: F,
    request_timeout: Duration,
    tunnel_timeout: Duration,
) where
    C: AsyncRead + AsyncWrite + Unpin,
    U: AsyncRead + AsyncWrite + Unpin,
    F: Fn(String, u16) -> Fut,
    Fut: Future<Output = std::io::Result<U>>,
{
    let request = match timeout(request_timeout, read_request(&mut client)).await {
        Ok(Ok(request)) => request,
        Ok(Err(status)) => {
            reject(client, status, "Invalid or unsupported proxy request").await;
            return;
        }
        Err(_) => {
            reject(client, 408, "Proxy request timed out").await;
            return;
        }
    };

    match request.target {
        ProxyTarget::Connect { host, port } => {
            if !matches!(port, 443 | 8443) {
                reject(client, 403, "Only public HTTPS tunnels are allowed").await;
                return;
            }
            let mut upstream = match connect(host, port).await {
                Ok(stream) => stream,
                Err(_) => {
                    reject(client, 403, "Destination is not a verified public host").await;
                    return;
                }
            };
            if client
                .write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                .await
                .is_err()
            {
                return;
            }
            let _ = timeout(
                tunnel_timeout,
                tokio::io::copy_bidirectional(&mut client, &mut upstream),
            )
            .await;
        }
        ProxyTarget::Http {
            method,
            url,
            headers,
        } => {
            let port = url.port_or_known_default().unwrap_or(80);
            if !is_allowed_plain_http_port(port) {
                reject(client, 403, "Only public web ports are allowed").await;
                return;
            }
            let host = url.host_str().unwrap_or_default().to_string();
            let mut upstream = match connect(host, port).await {
                Ok(stream) => stream,
                Err(_) => {
                    reject(client, 403, "Destination is not a verified public host").await;
                    return;
                }
            };
            let mut outbound = format!("{method} {} HTTP/1.1\r\n", request_target(&url));
            for (name, value) in headers {
                let normalized = name.to_ascii_lowercase();
                if matches!(
                    normalized.as_str(),
                    "proxy-connection" | "proxy-authorization" | "connection" | "host"
                ) {
                    continue;
                }
                outbound.push_str(&name);
                outbound.push_str(": ");
                outbound.push_str(&value);
                outbound.push_str("\r\n");
            }
            outbound.push_str("Host: ");
            outbound.push_str(&authority_for(&url));
            outbound.push_str("\r\nConnection: close\r\n\r\n");
            // `parse_proxy_target` rejects any plain-HTTP request with a body,
            // so only the request head is forwarded.
            if upstream.write_all(outbound.as_bytes()).await.is_err() {
                reject(client, 502, "Could not forward the public HTTP request").await;
                return;
            }
            let _ = timeout(request_timeout, tokio::io::copy(&mut upstream, &mut client)).await;
        }
    }
}
