use super::findings::add_finding;
use crate::models::audit_data::AmpFinding;
use scraper::{Html, Selector};

use url::Url;

pub(super) fn declarations(
    document: &Html,
    base: Option<&Url>,
) -> (Vec<Option<String>>, Option<String>) {
    let canonical_selector = Selector::parse("link[rel~='canonical']").unwrap();
    let canonical_declarations = document
        .select(&canonical_selector)
        .map(|element| {
            element
                .value()
                .attr("href")
                .map(|href| href.trim().to_string())
        })
        .collect::<Vec<_>>();
    let canonical_url = canonical_declarations
        .iter()
        .flatten()
        .find(|href| !href.is_empty())
        .map(|href| {
            base.as_ref()
                .and_then(|base| base.join(href).ok())
                .map(|url| url.to_string())
                .unwrap_or_else(|| href.to_string())
        });
    (canonical_declarations, canonical_url)
}

pub(super) fn check(
    canonical_declarations: &[Option<String>],
    canonical_url: Option<&str>,
    findings: &mut Vec<AmpFinding>,
) {
    if canonical_declarations.is_empty() {
        add_finding(
        findings,
        "amp-canonical-missing",
        "error",
        "AMP document does not declare a canonical URL.".into(),
        "No link[rel~=canonical][href] was found.".into(),
        "Add a canonical link to the preferred non-AMP URL (or to itself only when it is the canonical document).",
    );
    } else {
        let has_empty_canonical = canonical_declarations.iter().any(|href| {
            href.as_deref()
                .map(|value| value.is_empty())
                .unwrap_or(true)
        });
        if canonical_url.is_none() || has_empty_canonical {
            add_finding(
                findings,
                "amp-canonical-href-empty",
                "error",
                "AMP document declares a canonical link without a usable href.".into(),
                "link[rel~=canonical] has no non-empty href.".into(),
                "Provide one non-empty absolute or resolvable HTTP(S) canonical URL.",
            );
        }
        if canonical_declarations.len() > 1 {
            add_finding(
                findings,
                "amp-canonical-multiple",
                "warning",
                "AMP document declares more than one canonical link.".into(),
                format!(
                    "Found {} link[rel~=canonical] declarations.",
                    canonical_declarations.len()
                ),
                "Keep one canonical declaration for the AMP document.",
            );
        }
        if let Some(canonical) = canonical_url {
            let valid_http_target = Url::parse(canonical).ok().is_some_and(|url| {
                matches!(url.scheme(), "http" | "https") && url.host_str().is_some()
            });
            if !valid_http_target {
                add_finding(
                    findings,
                    "amp-canonical-target-invalid",
                    "error",
                    "AMP canonical does not resolve to an HTTP(S) URL.".into(),
                    canonical.to_string(),
                    "Use a valid absolute or resolvable HTTP(S) canonical URL.",
                );
            }
        }
    }
}
