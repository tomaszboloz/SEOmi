use crate::models::audit_data::AmpFinding;
use scraper::{Html, Selector};
use url::Url;
use super::models::{add_finding, MAX_AMPHTML_TARGETS};

pub(super) fn extract_amphtml_targets(
    document: &Html,
    parsed_base: Option<&Url>,
    findings: &mut Vec<AmpFinding>,
) -> Vec<String> {
    let amphtml_selector = Selector::parse("link[rel~='amphtml'][href]").expect("static selector valid");
    let mut amphtml_urls = Vec::new();
    for link in document.select(&amphtml_selector).take(MAX_AMPHTML_TARGETS + 1) {
        let Some(href) = link.value().attr("href").map(str::trim) else { continue };
        if href.is_empty() {
            add_finding(
                findings, "amphtml-href-empty", "warning",
                "A rel=amphtml link has an empty href.".into(),
                "link[rel~=amphtml] has no usable href".into(),
                "Provide one absolute or resolvable HTTP(S) AMP URL.",
            );
            continue;
        }
        let target = parsed_base.and_then(|base| base.join(href).ok())
            .map(|url| url.to_string())
            .unwrap_or_else(|| href.to_string());
        if amphtml_urls.len() < MAX_AMPHTML_TARGETS {
            amphtml_urls.push(target.clone());
        }
        let valid_http = Url::parse(&target).ok().is_some_and(|url| {
            matches!(url.scheme(), "http" | "https") && url.host_str().is_some()
        });
        if !valid_http {
            add_finding(
                findings, "amphtml-target-invalid", "warning",
                "The declared AMP alternate does not resolve to an HTTP(S) URL.".into(),
                target,
                "Use a valid HTTP(S) URL for the AMP alternate.",
            );
        }
    }
    if document.select(&amphtml_selector).count() > MAX_AMPHTML_TARGETS {
        add_finding(
            findings, "amphtml-target-limit", "info",
            "AMP alternate extraction reached its safety limit.".into(),
            format!("At most {MAX_AMPHTML_TARGETS} rel=amphtml targets are retained."),
            "Review the document manually; additional AMP alternate declarations were not inspected.",
        );
    }
    amphtml_urls.sort();
    amphtml_urls.dedup();
    if amphtml_urls.len() > 1 {
        add_finding(
            findings, "amphtml-multiple-targets", "warning",
            "The document declares more than one distinct AMP alternate.".into(),
            amphtml_urls.join(" | "),
            "Keep one intended AMP alternate for this canonical page.",
        );
    }
    amphtml_urls
}

pub(super) fn extract_canonical_target<'a>(
    canonical_declarations: &[Option<&'a str>],
    parsed_base: Option<&Url>,
) -> Option<String> {
    canonical_declarations.iter().flatten().copied()
        .find(|href| !href.is_empty())
        .map(|href| {
            parsed_base.and_then(|base| base.join(href).ok())
                .map(|url| url.to_string())
                .unwrap_or_else(|| href.to_string())
        })
}
