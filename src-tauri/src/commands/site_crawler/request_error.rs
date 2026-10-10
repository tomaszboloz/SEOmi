pub(super) fn classify_request_error(
    is_timeout: bool,
    is_connect: bool,
    detail: &str,
) -> &'static str {
    let detail = detail.to_ascii_lowercase();
    if is_timeout
        || detail.contains("timed out")
        || detail.contains("timeout")
        || detail.contains("deadline has elapsed")
    {
        return "timeout";
    }
    // DNS and TLS failures are often wrapped by reqwest as a generic connect
    // error. Inspect the full source-chain text before falling back to the
    // broad connect bucket so the UI and CSV retain the useful root cause.
    if detail.contains("dns")
        || detail.contains("name or service not known")
        || detail.contains("temporary failure in name resolution")
        || detail.contains("failed to lookup address")
        || detail.contains("could not resolve host")
        || detail.contains("nodename nor servname")
        || detail.contains("no such host")
    {
        return "dns";
    }
    if detail.contains("tls")
        || detail.contains("certificate")
        || detail.contains("unknown ca")
        || detail.contains("invalid peer certificate")
        || detail.contains("handshake failure")
        || detail.contains("rustls")
        || detail.contains("native-tls")
    {
        return "tls";
    }
    if is_connect
        || detail.contains("connection refused")
        || detail.contains("connection reset")
        || detail.contains("connection aborted")
        || detail.contains("failed to connect")
        || detail.contains("connect error")
        || detail.contains("network is unreachable")
    {
        return "connect";
    }
    "network"
}

pub(super) fn request_error_kind(error: &reqwest::Error) -> String {
    use std::error::Error;
    let mut detail = error.to_string();
    let mut source = error.source();
    while let Some(cause) = source {
        detail.push_str(" | ");
        detail.push_str(&cause.to_string());
        source = cause.source();
    }
    classify_request_error(error.is_timeout(), error.is_connect(), &detail).into()
}

#[cfg(test)]
#[path = "request_error_tests.rs"]
mod tests;
