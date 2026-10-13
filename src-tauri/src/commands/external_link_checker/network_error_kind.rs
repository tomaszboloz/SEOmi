pub fn error_kind(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        return "timeout".into();
    }
    if error.is_connect() {
        if schannel_debug_error(&format!("{error:?}")) {
            return "tls".into();
        }
        return connect_chain_kind(std::error::Error::source(error)).into();
    }
    "network".into()
}

fn connect_chain_kind(mut cause: Option<&(dyn std::error::Error + 'static)>) -> &'static str {
    let mut message = String::new();
    while let Some(current) = cause {
        if current
            .downcast_ref::<std::io::Error>()
            .and_then(std::io::Error::raw_os_error)
            .is_some_and(is_schannel_tls_error)
            || schannel_debug_error(&format!("{current:?}"))
        {
            return "tls";
        }
        message.push_str(&current.to_string().to_ascii_lowercase());
        message.push(' ');
        cause = current.source();
    }
    if message.contains("dns") || message.contains("resolve") || message.contains("lookup") {
        return "dns";
    }
    if message.contains("tls") || message.contains("certificate") || message.contains("handshake") {
        return "tls";
    }
    "connect"
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
    let unsigned = code as u32;
    (0x80090300..=0x800903ff).contains(&unsigned) || (0x80092000..=0x800920ff).contains(&unsigned)
}

#[cfg(test)]
mod tests {
    use super::{connect_chain_kind, is_schannel_tls_error, schannel_debug_error};

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

    #[derive(Debug)]
    struct Link(&'static str, Option<Box<Link>>);
    impl std::fmt::Display for Link {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str(self.0)
        }
    }
    impl std::error::Error for Link {
        fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
            self.1.as_deref().map(|link| link as _)
        }
    }

    #[test]
    fn connect_chains_are_classified_from_codes_debug_output_and_messages() {
        assert_eq!(connect_chain_kind(None), "connect");
        let os = std::io::Error::from_raw_os_error(0x8009030fu32 as i32);
        assert_eq!(connect_chain_kind(Some(&os)), "tls");
        let plain = std::io::Error::other("refused");
        assert_eq!(connect_chain_kind(Some(&plain)), "connect");
        let hidden = Link("Os { code: -2146893018, kind: Other }", None);
        let wrapped = Link("outer", Some(Box::new(hidden)));
        assert_eq!(connect_chain_kind(Some(&wrapped)), "tls");
        let cert = Link("bad Certificate", Some(Box::new(Link("inner", None))));
        assert_eq!(connect_chain_kind(Some(&cert)), "tls");
        let dns = Link("dns failure", Some(Box::new(Link("tls", None))));
        assert_eq!(connect_chain_kind(Some(&dns)), "dns");
        for (marker, kind) in [
            ("could not resolve host", "dns"),
            ("lookup failed", "dns"),
            ("tls alert", "tls"),
            ("handshake failed", "tls"),
        ] {
            assert_eq!(connect_chain_kind(Some(&Link(marker, None))), kind);
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
