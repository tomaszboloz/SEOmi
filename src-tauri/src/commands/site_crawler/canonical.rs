use super::*;

pub(super) fn classify_canonical_relation(
    final_url: &str,
    declaration_count: usize,
    canonical_targets: &[String],
) -> &'static str {
    if declaration_count == 0 {
        return "missing";
    }
    if declaration_count > 1 {
        return "multiple";
    }
    let Some(canonical) = canonical_targets.first() else {
        return "invalid";
    };
    let (Some(final_url), Some(canonical_url)) = (
        canonical_identity_url(final_url),
        canonical_identity_url(canonical),
    ) else {
        return "invalid";
    };
    if final_url == canonical_url {
        "self"
    } else if final_url
        .host_str()
        .zip(canonical_url.host_str())
        .is_some_and(|(left, right)| left.eq_ignore_ascii_case(right))
    {
        "same-host-other-url"
    } else {
        "different-host"
    }
}

/// Return a conservative URL identity for canonical comparisons.
pub(super) fn canonical_identity_url(input: &str) -> Option<url::Url> {
    let mut url = url::Url::parse(input).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    url.set_fragment(None);
    if url.path().is_empty() {
        url.set_path("/");
    }
    let default_port = match url.scheme() {
        "http" => Some(80),
        "https" => Some(443),
        _ => None,
    };
    if default_port.is_some_and(|port| url.port() == Some(port)) {
        let _ = url.set_port(None);
    }
    let normalized = canonicalize_unreserved_percent_encoding(url.as_str());
    url::Url::parse(&normalized).ok()
}

pub(super) fn crawl_canonical_declarations(
    document: &Html,
    final_url: &url::Url,
) -> (usize, Vec<String>) {
    let Ok(selector) = Selector::parse("link[rel]") else {
        return (0, Vec::new());
    };
    let canonical_links = document
        .select(&selector)
        .filter(|element| {
            element.value().attr("rel").is_some_and(|rel| {
                rel.split_ascii_whitespace()
                    .any(|value| value.eq_ignore_ascii_case("canonical"))
            })
        })
        .collect::<Vec<_>>();
    let declaration_count = canonical_links.len();
    let targets = canonical_links
        .iter()
        .filter_map(|element| element.value().attr("href"))
        .map(str::trim)
        .filter(|href| !href.is_empty())
        .filter_map(|href| final_url.join(href).ok())
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(|url| url.to_string())
        .collect();
    (declaration_count, targets)
}

pub(super) fn duplicate_text_indices<'a>(
    values: impl IntoIterator<Item = Option<&'a str>>,
) -> Vec<Vec<usize>> {
    let mut indexes: HashMap<String, Vec<usize>> = HashMap::new();
    for (index, value) in values.into_iter().enumerate() {
        if let Some(normalized) = value.map(str::trim).filter(|v| !v.is_empty()) {
            indexes.entry(normalized.to_lowercase()).or_default().push(index);
        }
    }
    indexes.into_values().filter(|group| group.len() > 1).collect()
}

pub(super) fn verify_canonical_target(
    target: &mut CrawledCanonicalTarget,
    crawled_statuses: &HashMap<String, u16>,
) -> Option<u16> {
    let status = crawled_statuses.get(&target.url).copied()?;
    target.http_status = Some(status);
    target.checked_in_run = true;
    Some(status)
}
