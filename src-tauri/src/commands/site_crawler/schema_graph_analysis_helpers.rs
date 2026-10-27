use super::*;
use std::collections::{HashMap, HashSet};
use url::Url;

pub(super) fn add_issue(
    issues: &mut HashMap<usize, HashSet<String>>,
    page: usize,
    message: String,
) {
    issues.entry(page).or_default().insert(message);
}

pub(super) fn normalized(value: &str) -> String {
    value.trim().to_lowercase()
}

pub(super) fn normalized_same_as(value: &str) -> String {
    Url::parse(value.trim())
        .map(|url| url.to_string())
        .unwrap_or_else(|_| value.trim().to_string())
}

pub(super) fn page_base(page: &CrawledPageSummary) -> &str {
    let final_url = page.final_url.trim();
    if Url::parse(final_url)
        .ok()
        .is_some_and(|url| matches!(url.scheme(), "http" | "https"))
    {
        page.final_url.as_str()
    } else {
        page.url.as_str()
    }
}

pub(super) fn graph_evidence_complete(page: &CrawledPageSummary) -> bool {
    ((200..400).contains(&page.http_status)
        || (page.http_status == 0
            && page.semantic_content_provenance == "rendered"
            && page.semantic_content_source != "unavailable"))
        && page.request_error_kind.is_none()
        && page.redirect_stop_reason.is_none()
        && !page.body_truncated
        && !page.schema_validation_truncated
        && page.schema_references.len() < MAX_SCHEMA_REFERENCES_PER_PAGE
        && page
            .schema_references
            .iter()
            .filter(|reference| reference.format == "JSON-LD")
            .all(|reference| reference.node_path.is_some())
}

pub(super) fn entity_type(value: &str) -> String {
    value
        .rsplit(['#', '/', ':'])
        .next()
        .map(normalized)
        .unwrap_or_default()
}

pub(super) fn page_identity(value: &str) -> Option<String> {
    let mut url = Url::parse(value).ok()?;
    url.set_fragment(None);
    canonical_identity_url(url.as_str()).map(|url| url.to_string())
}

pub(super) fn local_identifier(
    page_url: &str,
    value: &str,
    hosts: &HashSet<String>,
) -> Option<String> {
    let base = Url::parse(page_url).ok()?;
    let mut url = base.join(value.trim()).ok()?;
    if !matches!(url.scheme(), "http" | "https")
        || !url
            .host_str()
            .is_some_and(|host| hosts.contains(&host.to_ascii_lowercase()))
    {
        return None;
    }
    let fragment = url.fragment().map(str::to_owned);
    url.set_fragment(None);
    let mut normalized = canonical_identity_url(url.as_str())?;
    normalized.set_fragment(fragment.as_deref());
    Some(normalized.to_string())
}
