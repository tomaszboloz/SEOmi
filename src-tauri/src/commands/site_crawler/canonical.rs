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
///
/// This deliberately does not strip trailing slashes, sort parameters, or
/// remove arbitrary query keys: those choices can be meaningful to a server.
/// It only removes fragments, drops default ports, gives the authority root a
/// stable `/` path, and normalizes unreserved percent escapes.
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

pub(super) fn pagination_query_changes(
    source_url: &url::Url,
    target_url: &url::Url,
) -> Vec<String> {
    let query_values = |url: &url::Url| {
        url.query_pairs().fold(
            HashMap::<String, Vec<String>>::new(),
            |mut values, (key, value)| {
                values
                    .entry(key.into_owned())
                    .or_default()
                    .push(value.into_owned());
                values
            },
        )
    };
    let source = query_values(source_url);
    let target = query_values(target_url);
    let mut keys = source
        .keys()
        .chain(target.keys())
        .cloned()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    keys.sort();
    keys.into_iter()
        .filter_map(|key| {
            let old = source.get(&key);
            let new = target.get(&key);
            (old != new).then(|| {
                format!(
                    "{key}: {} → {}",
                    old.map(|values| values.join(", "))
                        .unwrap_or_else(|| "∅".into()),
                    new.map(|values| values.join(", "))
                        .unwrap_or_else(|| "∅".into())
                )
            })
        })
        .collect()
}

pub(super) fn crawl_pagination_links(
    document: &Html,
    final_url: &url::Url,
) -> (Vec<CrawledPaginationLink>, usize, usize) {
    // HTML allows pagination relations on both metadata links and ordinary
    // navigational anchors. Search engines and real sites use both forms;
    // restricting this to `link[rel]` silently dropped valid `<a rel=next>`
    // declarations from the crawl evidence.
    let Ok(selector) = Selector::parse("link[rel], a[rel]") else {
        return (Vec::new(), 0, 0);
    };
    let mut links = Vec::new();
    let mut declaration_count = 0;
    let mut invalid_declaration_count = 0;
    for element in document.select(&selector) {
        let Some(rel) = element.value().attr("rel") else {
            continue;
        };
        for relation in rel.split_ascii_whitespace().filter(|value| {
            value.eq_ignore_ascii_case("next") || value.eq_ignore_ascii_case("prev")
        }) {
            declaration_count += 1;
            let target = element
                .value()
                .attr("href")
                .map(str::trim)
                .filter(|href| !href.is_empty())
                .and_then(|href| final_url.join(href).ok())
                .filter(|url| matches!(url.scheme(), "http" | "https"));
            let Some(target) = target else {
                invalid_declaration_count += 1;
                continue;
            };
            links.push(CrawledPaginationLink {
                relation: relation.to_ascii_lowercase(),
                query_parameter_changes: pagination_query_changes(final_url, &target),
                target_url: target.to_string(),
                http_status: None,
                checked_in_run: false,
                reciprocal_in_run: None,
            });
        }
    }
    (links, declaration_count, invalid_declaration_count)
}

pub(super) fn pagination_canonical_alignment(canonical_relation: &str) -> Option<String> {
    let alignment = match canonical_relation {
        "self" => "self-canonical",
        "missing" => "missing-canonical",
        "multiple" => "multiple-canonical",
        "invalid" => "invalid-canonical",
        "unavailable" => return None,
        _ => "canonical-points-elsewhere",
    };
    Some(alignment.into())
}

pub(super) fn duplicate_text_indices<'a>(
    values: impl IntoIterator<Item = Option<&'a str>>,
) -> Vec<Vec<usize>> {
    let mut indexes: HashMap<String, Vec<usize>> = HashMap::new();
    for (index, value) in values.into_iter().enumerate() {
        if let Some(normalized) = value.map(str::trim).filter(|value| !value.is_empty()) {
            indexes
                .entry(normalized.to_lowercase())
                .or_default()
                .push(index);
        }
    }
    indexes
        .into_values()
        .filter(|group| group.len() > 1)
        .collect()
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

pub(super) fn verify_pagination_target(
    target: &mut CrawledPaginationLink,
    crawled_statuses: &HashMap<String, u16>,
) -> Option<u16> {
    let status = crawled_statuses.get(&target.target_url).copied()?;
    target.http_status = Some(status);
    target.checked_in_run = true;
    Some(status)
}

pub(super) fn opposite_pagination_relation(relation: &str) -> Option<&'static str> {
    match relation.to_ascii_lowercase().as_str() {
        "next" => Some("prev"),
        "prev" => Some("next"),
        _ => None,
    }
}

/// Build a bounded identity graph for pagination declarations. Both the
/// requested and final URL are accepted as a page identity so redirects do
/// not erase a reciprocal edge.
pub(super) fn pagination_edges(pages: &[CrawledPageSummary]) -> HashSet<(String, String, String)> {
    let mut edges = HashSet::new();
    for page in pages {
        let source_keys = [page.url.as_str(), page.final_url.as_str()]
            .into_iter()
            .filter_map(canonical_identity_url)
            .map(|url| url.to_string())
            .collect::<Vec<_>>();
        for link in &page.pagination_links {
            let Some(target) = canonical_identity_url(&link.target_url).map(|url| url.to_string())
            else {
                continue;
            };
            let relation = link.relation.to_ascii_lowercase();
            for source in &source_keys {
                edges.insert((source.clone(), relation.clone(), target.clone()));
            }
        }
    }
    edges
}

pub(super) fn verify_amp_target(
    source_url: &str,
    source_final_url: &str,
    target_url: &str,
    crawled_statuses: &HashMap<String, u16>,
    canonical_targets: &HashMap<String, Option<String>>,
) -> (Option<u16>, Option<String>) {
    let Some(status) = crawled_statuses.get(target_url).copied() else {
        return (None, None);
    };
    let Some(canonical) = canonical_targets.get(target_url) else {
        return (Some(status), None);
    };
    let alignment = match canonical {
        Some(canonical)
            if same_hreflang_url(canonical, source_url)
                || same_hreflang_url(canonical, source_final_url) =>
        {
            "canonical-to-source"
        }
        Some(canonical) if same_hreflang_url(canonical, target_url) => "self-canonical",
        Some(_) => "canonical-points-elsewhere",
        None => "missing-canonical",
    };
    (Some(status), Some(alignment.into()))
}

pub(super) fn parse_client_redirect(
    source: &str,
    declaration: &str,
    base_url: &url::Url,
) -> CrawledClientRedirect {
    let (delay, destination) = declaration
        .split_once(';')
        .map(|(delay, destination)| (delay.trim(), Some(destination.trim())))
        .unwrap_or((declaration.trim(), None));
    let delay_seconds = delay
        .parse::<f64>()
        .ok()
        .filter(|seconds| seconds.is_finite() && *seconds >= 0.0);
    let target_url = destination
        .and_then(|value| value.split_once('='))
        .filter(|(key, _)| key.trim().eq_ignore_ascii_case("url"))
        .map(|(_, value)| value.trim().trim_matches(['\"', '\'']))
        .filter(|value| !value.is_empty())
        .and_then(|value| base_url.join(value).ok())
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(|url| url.to_string());
    CrawledClientRedirect {
        source: source.into(),
        declaration: declaration.into(),
        delay_seconds,
        target_url,
    }
}

/// Extract only literal JavaScript navigations from inline scripts.
///
/// This is intentionally static evidence: scripts are never executed, dynamic
/// expressions are not guessed, and non-JavaScript script types (JSON-LD,
/// import maps, templates) are ignored. The bounded result keeps a hostile
/// page from inflating one URL's redirect inventory.
pub(super) fn extract_javascript_redirects(
    document: &Html,
    base_url: &url::Url,
) -> Vec<CrawledClientRedirect> {
    const MAX_REDIRECTS_PER_PAGE: usize = 32;
    let Ok(script_selector) = Selector::parse("script:not([src])") else {
        return Vec::new();
    };
    let Ok(event_selector) = Selector::parse(
        "*[onclick],*[onload],*[onbeforeunload],*[onunload],*[onpageshow],*[onpopstate]",
    ) else {
        return Vec::new();
    };
    // Rust's regex engine intentionally does not support backreferences, so
    // keep the quote-delimited and template-literal patterns separate. A
    // template literal is accepted only when it has no interpolation; this is
    // static evidence and never evaluates JavaScript expressions.
    let assignment = Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location(?:\.href)?\s*=\s*(['\"])([^'\"]{1,2048})['\"]"#,
    )
    .expect("javascript location assignment pattern is valid");
    let assignment_template = Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location(?:\.href)?\s*=\s*`([^`$]{1,2048})`"#,
    )
    .expect("javascript template location assignment pattern is valid");
    let call = Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location\.(?:replace|assign)\s*\(\s*(['\"])([^'\"]{1,2048})['\"]\s*\)"#,
    )
    .expect("javascript location call pattern is valid");
    let call_template = Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location\.(?:replace|assign)\s*\(\s*`([^`$]{1,2048})`\s*\)"#,
    )
    .expect("javascript template location call pattern is valid");
    let mut redirects = Vec::new();
    let mut seen = HashSet::new();

    let mut scan_source = |source: &str, evidence_source: &str| {
        if redirects.len() >= MAX_REDIRECTS_PER_PAGE {
            return;
        }
        for captures in [&assignment, &call] {
            for matched in captures.captures_iter(source) {
                let Some(full) = matched.get(0).map(|value| value.as_str().trim()) else {
                    continue;
                };
                let Some(target) = matched.get(2).map(|value| value.as_str().trim()) else {
                    continue;
                };
                let target_url = base_url
                    .join(target)
                    .ok()
                    .filter(|url| matches!(url.scheme(), "http" | "https"))
                    .map(|url| url.to_string());
                let dedupe_key = format!("{evidence_source}\u{1f}{full}\u{1f}{target_url:?}");
                if seen.insert(dedupe_key) {
                    redirects.push(CrawledClientRedirect {
                        source: evidence_source.into(),
                        declaration: full.chars().take(2048).collect(),
                        delay_seconds: None,
                        target_url,
                    });
                    if redirects.len() >= MAX_REDIRECTS_PER_PAGE {
                        return;
                    }
                }
            }
        }
        for captures in [&assignment_template, &call_template] {
            for matched in captures.captures_iter(source) {
                let Some(full) = matched.get(0).map(|value| value.as_str().trim()) else {
                    continue;
                };
                let Some(target) = matched.get(1).map(|value| value.as_str().trim()) else {
                    continue;
                };
                let target_url = base_url
                    .join(target)
                    .ok()
                    .filter(|url| matches!(url.scheme(), "http" | "https"))
                    .map(|url| url.to_string());
                let dedupe_key = format!("{evidence_source}\u{1f}{full}\u{1f}{target_url:?}");
                if seen.insert(dedupe_key) {
                    redirects.push(CrawledClientRedirect {
                        source: evidence_source.into(),
                        declaration: full.chars().take(2048).collect(),
                        delay_seconds: None,
                        target_url,
                    });
                    if redirects.len() >= MAX_REDIRECTS_PER_PAGE {
                        return;
                    }
                }
            }
        }
    };

    for script in document.select(&script_selector) {
        if let Some(script_type) = script.value().attr("type") {
            let normalized = script_type.trim().to_ascii_lowercase();
            if !normalized.is_empty()
                && !normalized.contains("javascript")
                && !normalized.contains("ecmascript")
                && normalized != "module"
            {
                continue;
            }
        }
        let source = script.text().collect::<String>();
        scan_source(&source, "javascript");
    }

    for element in document.select(&event_selector) {
        for (name, value) in element.value().attrs() {
            if name.starts_with("on") {
                scan_source(value, "javascript-inline");
            }
        }
    }
    redirects
}
