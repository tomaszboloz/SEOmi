use crate::models::audit_data::{CookieSecurityFinding, TechnologySignal};
use crate::services::html_parser::resolve_url;
use scraper::{Html, Selector};
use url::Url;

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

pub(super) fn detect_mixed_content_resources(html: &str, page_url: &Url) -> Vec<String> {
    if page_url.scheme() != "https" {
        return Vec::new();
    }
    let document = Html::parse_document(html);
    let selector = Selector::parse(
        "script[src], img[src], iframe[src], frame[src], source[src], video[src], audio[src], track[src], embed[src], object[data], form[action], link[rel~='stylesheet'][href], link[rel~='preload'][href]",
    )
    .expect("static embedded-resource selector is valid");
    let mut found = std::collections::BTreeSet::new();
    for element in document.select(&selector) {
        let attribute = if element.value().name() == "object" {
            "data"
        } else if element.value().name() == "form" {
            "action"
        } else if element.value().name() == "link" {
            "href"
        } else {
            "src"
        };
        if let Some(value) = element.value().attr(attribute) {
            collect_http_resource(value, page_url, &mut found);
        }
        if matches!(element.value().name(), "img" | "source") {
            if let Some(srcset) = element.value().attr("srcset") {
                for candidate in srcset.split(',') {
                    if let Some(value) = candidate.split_ascii_whitespace().next() {
                        collect_http_resource(value, page_url, &mut found);
                    }
                }
            }
        }
    }
    let style_selector = Selector::parse("[style]").expect("static style selector is valid");
    for element in document.select(&style_selector) {
        if let Some(style) = element.value().attr("style") {
            for candidate in style.split("url(").skip(1) {
                let value = candidate
                    .trim_start_matches([' ', '\'', '"'])
                    .split([')', '\'', '"'])
                    .next()
                    .unwrap_or_default()
                    .trim();
                collect_http_resource(value, page_url, &mut found);
            }
        }
    }
    found.into_iter().take(100).collect()
}

pub(super) fn collect_http_resource(
    value: &str,
    page_url: &Url,
    output: &mut std::collections::BTreeSet<String>,
) {
    let value = value.trim();
    if value.is_empty() || value.starts_with("data:") || value.starts_with("blob:") {
        return;
    }
    let Ok(mut resolved) = Url::parse(&resolve_url(value, Some(page_url))) else {
        return;
    };
    if resolved.scheme() != "http" {
        return;
    }
    resolved.set_query(None);
    resolved.set_fragment(None);
    output.insert(resolved.to_string());
}

pub(super) fn assess_cookie_headers(headers: &[String]) -> Vec<CookieSecurityFinding> {
    headers
        .iter()
        .filter_map(|header| {
            let (pair, attributes) = header
                .split_once(';')
                .map_or((header.as_str(), ""), |(pair, rest)| (pair, rest));
            let (name, _) = pair.split_once('=')?;
            let name = name.trim();
            if name.is_empty()
                || name.len() > 128
                || !name.chars().all(|character| {
                    character.is_ascii_alphanumeric()
                        || matches!(
                            character,
                            '!' | '#'
                                | '$'
                                | '%'
                                | '&'
                                | '\''
                                | '*'
                                | '+'
                                | '-'
                                | '.'
                                | '^'
                                | '_'
                                | '`'
                                | '|'
                                | '~'
                        )
                })
            {
                return None;
            }
            let mut secure = false;
            let mut http_only = false;
            let mut same_site = None;
            for attribute in attributes
                .split(';')
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                let (key, value) = attribute
                    .split_once('=')
                    .map_or((attribute, None), |(key, value)| {
                        (key.trim(), Some(value.trim()))
                    });
                if key.eq_ignore_ascii_case("secure") {
                    secure = true;
                }
                if key.eq_ignore_ascii_case("httponly") {
                    http_only = true;
                }
                if key.eq_ignore_ascii_case("samesite") {
                    same_site = value
                        .filter(|value| {
                            matches!(
                                value.to_ascii_lowercase().as_str(),
                                "strict" | "lax" | "none"
                            )
                        })
                        .map(|value| {
                            match value.to_ascii_lowercase().as_str() {
                                "strict" => "Strict",
                                "lax" => "Lax",
                                _ => "None",
                            }
                            .to_string()
                        });
                }
            }
            Some(CookieSecurityFinding {
                name: name.to_string(),
                secure,
                http_only,
                same_site,
            })
        })
        .take(100)
        .collect()
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
