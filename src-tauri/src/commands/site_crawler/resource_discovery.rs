use super::*;

mod crawl_filters;
pub use crawl_filters::*;

pub(super) fn add_resource_candidate(
    candidates: &mut HashMap<String, ResourceCandidate>,
    source_url: &str,
    base: &url::Url,
    href: &str,
    resource_type: &str,
    base_host: &str,
    config: &CrawlConfig,
) {
    if !resource_type_enabled(resource_type, config) {
        return;
    }
    let Ok(resolved) = base.join(href) else {
        return;
    };
    let Ok(validated) = validate_and_normalize_url(resolved.as_str()) else {
        return;
    };
    if !matches_scope(
        &validated,
        base_host,
        config.allow_subdomains,
        config.scope_path.as_deref(),
        &config.allowed_hosts,
    ) {
        return;
    }
    let url = normalize_crawl_url(validated, config).to_string();
    if !candidates.contains_key(&url) && candidates.len() >= MAX_RESOURCE_DISCOVERY_CANDIDATES {
        return;
    }
    let candidate = candidates
        .entry(url.clone())
        .or_insert_with(|| ResourceCandidate {
            source_urls: Vec::new(),
            url,
            resource_type: resource_type.into(),
        });
    if candidate.source_urls.len() < 100
        && !candidate
            .source_urls
            .iter()
            .any(|value| value == source_url)
    {
        candidate.source_urls.push(source_url.to_owned());
    }
}

pub(super) fn is_other_resource_url(url: &url::Url) -> bool {
    let path = url.path().to_ascii_lowercase();
    [
        ".pdf", ".xml", ".json", ".zip", ".csv", ".txt", ".woff", ".woff2", ".ttf", ".otf", ".mp4",
        ".webm", ".mp3", ".wav",
    ]
    .iter()
    .any(|extension| path.ends_with(extension))
}
