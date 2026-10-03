use crate::models::audit_data::TechnologySignal;

#[path = "cookie_security.rs"]
mod cookie_security;
#[path = "mixed_content.rs"]
mod mixed_content;

pub(super) use cookie_security::assess_cookie_headers;
pub(super) use mixed_content::detect_mixed_content_resources;

pub(super) fn enrich_header_technologies(
    signals: &mut Vec<TechnologySignal>,
    headers: &std::collections::HashMap<String, String>,
) {
    let add = |name: &str,
               category: &str,
               evidence: String,
               version: Option<String>,
               output: &mut Vec<TechnologySignal>| {
        if !output
            .iter()
            .any(|signal| signal.name == name && signal.category == category)
        {
            output.push(TechnologySignal {
                name: name.to_string(),
                category: category.to_string(),
                evidence,
                confidence: "confirmed".to_string(),
                version,
            });
        }
    };

    if let Some(server) = headers
        .get("server")
        .filter(|value| !value.trim().is_empty())
    {
        let server = server.trim();
        let (name, version) = parse_header_technology(
            server,
            &["nginx", "Apache", "Caddy", "LiteSpeed", "Microsoft-IIS"],
        );
        add(
            name.as_deref().unwrap_or("Web server"),
            "HTTP server",
            format!("Server: {server}"),
            version,
            signals,
        );
    }
    if let Some(powered_by) = headers
        .get("x-powered-by")
        .filter(|value| !value.trim().is_empty())
    {
        let powered_by = powered_by.trim();
        let (name, version) = parse_header_technology(
            powered_by,
            &["PHP", "ASP.NET", "Express", "Phusion Passenger"],
        );
        add(
            name.as_deref().unwrap_or("Application runtime"),
            "HTTP runtime",
            format!("X-Powered-By: {powered_by}"),
            version,
            signals,
        );
    }
    if headers.contains_key("cf-ray")
        || headers
            .get("server")
            .is_some_and(|value| value.to_ascii_lowercase().contains("cloudflare"))
    {
        add(
            "Cloudflare",
            "CDN / edge",
            "CF-Ray or Server response header confirms Cloudflare.".to_string(),
            None,
            signals,
        );
    }
}

pub(super) fn parse_header_technology(
    value: &str,
    known_products: &[&str],
) -> (Option<String>, Option<String>) {
    for product in known_products {
        let Some(remainder) = value
            .get(..product.len())
            .filter(|prefix| prefix.eq_ignore_ascii_case(product))
            .and_then(|_| value.get(product.len()..))
        else {
            continue;
        };
        if !remainder.starts_with('/') {
            continue;
        }
        let version = remainder
            .trim_start_matches('/')
            .split_ascii_whitespace()
            .next()
            .and_then(|candidate| {
                let candidate = candidate.trim_end_matches(|character: char| {
                    !character.is_ascii_alphanumeric() && character != '.' && character != '-'
                });
                let digits = candidate.split(['.', '-']).all(|part| {
                    !part.is_empty() && part.chars().all(|character| character.is_ascii_digit())
                });
                (digits && candidate.len() <= 32).then_some(candidate.to_string())
            });
        return (Some((*product).to_string()), version);
    }
    (None, None)
}
