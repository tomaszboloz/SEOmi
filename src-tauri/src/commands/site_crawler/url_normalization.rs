use super::*;

pub(super) fn normalized_query_parameter_names(values: &[String]) -> HashSet<String> {
    values
        .iter()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .collect()
}

pub(super) fn is_tracking_parameter(name: &str) -> bool {
    matches!(
        name,
        "gclid" | "dclid" | "fbclid" | "msclkid" | "mc_cid" | "mc_eid" | "_ga" | "_gl"
    ) || name.starts_with("utm_")
}

/// Canonicalize only RFC 3986 "unreserved" percent escapes.
pub(super) fn canonicalize_unreserved_percent_encoding(value: &str) -> String {
    fn is_unreserved(byte: u8) -> bool {
        byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~')
    }

    let mut output = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(character) = chars.next() {
        if character != '%' {
            output.push(character);
            continue;
        }

        let Some(high) = chars.next() else {
            output.push('%');
            break;
        };
        let Some(low) = chars.next() else {
            output.push('%');
            output.push(high);
            break;
        };
        let Some(high_value) = high.to_digit(16) else {
            output.push('%');
            output.push(high);
            output.push(low);
            continue;
        };
        let Some(low_value) = low.to_digit(16) else {
            output.push('%');
            output.push(high);
            output.push(low);
            continue;
        };

        let byte = ((high_value << 4) | low_value) as u8;
        if is_unreserved(byte) {
            output.push(byte as char);
        } else {
            output.push('%');
            output.push_str(&format!("{byte:02X}"));
        }
    }
    output
}

pub(super) fn normalize_crawl_url(mut url: url::Url, config: &CrawlConfig) -> url::Url {
    url.set_fragment(None);
    if let Some(host) = url.host_str() {
        let normalized_host = host.trim_end_matches('.').to_ascii_lowercase();
        if normalized_host != host {
            let _ = url.set_host(Some(&normalized_host));
        }
    }
    let default_port = match url.scheme() {
        "http" => Some(80),
        "https" => Some(443),
        _ => None,
    };
    if default_port.is_some_and(|port| url.port() == Some(port)) {
        let _ = url.set_port(None);
    }
    if config.lowercase_path {
        let path = url.path().to_ascii_lowercase();
        url.set_path(&path);
    }
    if config.trim_trailing_slash && url.path().len() > 1 {
        let path = url.path().trim_end_matches('/').to_string();
        url.set_path(&path);
    }
    if !config.keep_query_strings {
        url.set_query(None);
    } else {
        let allowed = normalized_query_parameter_names(&config.allowed_query_parameters);
        let denied = normalized_query_parameter_names(&config.denied_query_parameters);
        if config.strip_tracking_parameters || !allowed.is_empty() || !denied.is_empty() {
            let retained = url
                .query_pairs()
                .filter(|(name, _)| {
                    let name = name.to_ascii_lowercase();
                    (!config.strip_tracking_parameters || !is_tracking_parameter(&name))
                        && (allowed.is_empty() || allowed.contains(&name))
                        && !denied.contains(&name)
                })
                .map(|(name, value)| (name.into_owned(), value.into_owned()))
                .collect::<Vec<_>>();
            if retained.is_empty() {
                url.set_query(None);
            } else {
                let query = url::form_urlencoded::Serializer::new(String::new())
                    .extend_pairs(
                        retained
                            .iter()
                            .map(|(name, value)| (name.as_str(), value.as_str())),
                    )
                    .finish();
                url.set_query(Some(&query));
            }
        }
    }
    let normalized = canonicalize_unreserved_percent_encoding(url.as_str());
    url::Url::parse(&normalized).unwrap_or(url)
}
