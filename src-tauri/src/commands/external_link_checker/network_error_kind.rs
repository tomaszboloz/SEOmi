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
                || schannel_debug_error(&format!("{current:?}"))
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

// native-tls can hide the Schannel io::Error behind its opaque Error wrapper.
// Its Debug representation retains the numeric OS code; Display is localized.
fn schannel_debug_error(value: &str) -> bool {
    value
        .split("Os { code: ")
        .skip(1)
        .filter_map(|part| part.split(',').next()?.trim().parse::<i32>().ok())
        .any(is_schannel_tls_error)
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
    use super::{is_schannel_tls_error, schannel_debug_error};

    #[test]
    fn opaque_schannel_errors_require_an_exact_os_code() {
        assert!(schannel_debug_error(
            "Os { code: -2146893018, kind: Uncategorized }"
        ));
        for message in [
            "badly formatted",
            "schannel",
            "-2146893018",
            "Os { code: 10061, kind: Other }",
            "Os { code: invalid, kind: Other }",
        ] {
            assert!(!schannel_debug_error(message), "{message}");
        }
    }

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

#[cfg(test)]
#[path = "network_error_kind_coverage_tests.rs"]
mod coverage_tests;
