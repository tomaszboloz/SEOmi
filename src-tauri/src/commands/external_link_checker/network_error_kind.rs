pub fn error_kind(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        return "timeout".into();
    }
    if error.is_connect() {
        let mut message = String::new();
        let mut cause = std::error::Error::source(error);
        while let Some(current) = cause {
            if current
                .downcast_ref::<std::io::Error>()
                .and_then(std::io::Error::raw_os_error)
                .is_some_and(is_schannel_tls_error)
            {
                return "tls".into();
            }
            message.push_str(&current.to_string().to_ascii_lowercase());
            message.push(' ');
            cause = current.source();
        }
        if message.contains("dns") || message.contains("resolve") || message.contains("lookup") {
            return "dns".into();
        }
        if message.contains("tls")
            || message.contains("certificate")
            || message.contains("handshake")
        {
            return "tls".into();
        }
        return "connect".into();
    }
    "network".into()
}

// Schannel exposes localized OS errors rather than TLS words on Windows.
fn is_schannel_tls_error(code: i32) -> bool {
    matches!(
        code as u32,
        0x8009030f
            | 0x80090310
            | 0x80090318
            | 0x80090322
            | 0x80090325
            | 0x80090326
            | 0x80090327
            | 0x80090328
            | 0x80090330
            | 0x80090331
    )
}

#[cfg(test)]
mod tests {
    use super::is_schannel_tls_error;

    #[test]
    fn localized_schannel_failures_are_tls_and_socket_errors_remain_connect() {
        for code in [
            0x8009030fu32,
            0x80090310,
            0x80090318,
            0x80090322,
            0x80090325,
            0x80090326,
            0x80090327,
            0x80090328,
            0x80090330,
            0x80090331,
        ] {
            assert!(is_schannel_tls_error(code as i32), "{code:x}");
        }
        for code in [0, 22, 61, 10060, 10061, -1] {
            assert!(!is_schannel_tls_error(code), "{code}");
        }
    }
}
