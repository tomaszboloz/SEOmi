use crate::models::audit_data::{Issue, IssueCategory, IssueSeverity, LinkData, LinksAnalysis};
use crate::services::html_parser::resolve_url;
use scraper::{Html, Selector};
use url::Url;

pub(super) fn parse_links(html_str: &str, base_url: &Url) -> (LinksAnalysis, Vec<Issue>) {
    let document = Html::parse_document(html_str);
    let mut links = Vec::new();
    let mut issues = Vec::new();

    let a_selector = Selector::parse("a[href]").unwrap();
    let base_host = base_url.host_str().unwrap_or("").to_lowercase();

    let mut internal_count = 0;
    let mut external_count = 0;
    let mut nofollow_count = 0;
    let mut unsafe_blank_count = 0;
    let mut insecure_count = 0;

    for el in document.select(&a_selector) {
        let href_raw = el.value().attr("href").unwrap_or("").trim();
        if href_raw.is_empty() || href_raw.starts_with('#') || href_raw.starts_with("javascript:") {
            continue;
        }

        let full_href = resolve_url(href_raw, Some(base_url));
        let text = el.text().collect::<Vec<_>>().join(" ").trim().to_string();
        let rel = el.value().attr("rel").map(|s| s.trim().to_string());
        let target = el.value().attr("target").map(|s| s.trim().to_string());

        let is_internal = if let Ok(parsed_href) = Url::parse(&full_href) {
            let link_host = parsed_href.host_str().unwrap_or("").to_lowercase();
            link_host.is_empty()
                || link_host == base_host
                || link_host.ends_with(&format!(".{}", base_host))
        } else {
            true
        };

        if is_internal {
            internal_count += 1;
        } else {
            external_count += 1;
        }

        let is_nofollow = rel
            .as_ref()
            .map(|r| r.to_lowercase().contains("nofollow"))
            .unwrap_or(false);

        if is_nofollow {
            nofollow_count += 1;
        }

        let is_insecure = base_url.scheme() == "https" && full_href.starts_with("http://");
        if is_insecure {
            insecure_count += 1;
        }

        // Check for target="_blank" without rel="noopener noreferrer"
        if let Some(ref t) = target {
            if t == "_blank" {
                let rel_str = rel.as_deref().unwrap_or("").to_lowercase();
                if !rel_str.contains("noopener") && !rel_str.contains("noreferrer") {
                    unsafe_blank_count += 1;
                }
            }
        }

        links.push(LinkData {
            href: full_href,
            text,
            is_internal,
            rel,
            target,
            is_insecure,
        });
    }

    if unsafe_blank_count > 0 {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Links,
            code: Some("links_target_blank".into()),
            params: Some(std::collections::BTreeMap::from([("count".into(), unsafe_blank_count.to_string())])),
            message: format!(
                "{} external link(s) use target='_blank' without rel='noopener noreferrer'",
                unsafe_blank_count
            ),
            recommendation: Some("Add rel='noopener noreferrer' to external links with target='_blank' to prevent tabnabbing security vulnerability".to_string()),
        });
    }

    if insecure_count > 0 {
        issues.push(Issue {
            severity: IssueSeverity::Warning,
            category: IssueCategory::Links,
            code: Some("links_insecure".into()),
            params: Some(std::collections::BTreeMap::from([("count".into(), insecure_count.to_string())])),
            message: format!(
                "{} link destination(s) use HTTP on an HTTPS page; these are navigation links, not embedded mixed content",
                insecure_count
            ),
            recommendation: Some("Prefer HTTPS destinations for privacy and integrity. Embedded HTTP resources are reported separately as mixed content.".to_string()),
        });
    }

    let analysis = LinksAnalysis {
        total_links: links.len(),
        internal_links: internal_count,
        external_links: external_count,
        nofollow_links: nofollow_count,
        links,
    };

    (analysis, issues)
}

#[cfg(test)]
#[path = "links_tests.rs"]
mod tests;
