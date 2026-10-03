use std::time::Duration;
use url::Url;

pub(super) const MAX_HEADER_BYTES: usize = 64 * 1024;
pub(super) const MAX_REQUEST_BODY_BYTES: usize = 1024 * 1024;
pub(super) const MAX_CONCURRENT_CONNECTIONS: usize = 32;
pub(super) const ALLOWED_HTTP_PORTS: [u16; 2] = [80, 8080];
pub(super) const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
pub(super) const REQUEST_TIMEOUT: Duration = Duration::from_secs(45);
pub(super) const TUNNEL_TIMEOUT: Duration = Duration::from_secs(20 * 60);

pub(super) enum ProxyTarget {
    Connect {
        host: String,
        port: u16,
    },
    Http {
        method: String,
        url: Url,
        headers: Vec<(String, String)>,
    },
}

pub(super) struct ParsedRequest {
    pub(super) target: ProxyTarget,
    pub(super) body: Vec<u8>,
}

#[derive(Debug)]
pub(super) struct RequestHead {
    pub(super) method: String,
    pub(super) target: String,
    pub(super) headers: Vec<(String, String)>,
    pub(super) content_length: usize,
}

pub(super) use crate::utils::http_syntax::is_http_token_byte;

pub(super) fn is_allowed_plain_http_port(port: u16) -> bool {
    ALLOWED_HTTP_PORTS.contains(&port)
}
