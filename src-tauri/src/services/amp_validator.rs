use crate::models::audit_data::AmpAudit;
use scraper::{Html, Selector};
use url::Url;

mod canonical;
mod components;
mod elements;
mod findings;
mod links;
mod metadata;
mod scripts;
mod styles;

/// Bounded local AMP checks, without alternate fetches or official validator parity.
pub fn audit_amp(html: &str, page_url: &str) -> AmpAudit {
    let document = Html::parse_document(html);
    let root = Selector::parse("html").unwrap();
    let is_amp_document = document.select(&root).next().is_some_and(|element| {
        element.value().attr("amp").is_some() || element.value().attr("⚡").is_some()
    });
    let base = Url::parse(page_url).ok();
    let mut findings = Vec::new();
    let amphtml_urls = links::alternates(&document, base.as_ref(), &mut findings);
    let (canonical_declarations, canonical_url) = canonical::declarations(&document, base.as_ref());
    let detected = is_amp_document || !amphtml_urls.is_empty();
    if is_amp_document {
        canonical::check(
            &canonical_declarations,
            canonical_url.as_deref(),
            &mut findings,
        );
        metadata::check(&document, &mut findings);
        styles::check(&document, html, &mut findings);
        elements::check(&document, &mut findings);
        components::check(&document, &mut findings);
        scripts::check(&document, &mut findings);
    }
    AmpAudit {
        detected,
        is_amp_document,
        amphtml_urls,
        canonical_url,
        coverage: "partial-local-rules".to_string(),
        findings,
        unchecked: vec![
            "Official AMP validator rule set and version".into(),
            "Network status, redirects, canonical alignment, and content of declared AMP targets"
                .into(),
            "Complete AMP component, CSS, attribute, and structured-data validation".into(),
        ],
    }
}

#[cfg(test)]
mod baseline_tests;
#[cfg(test)]
mod document_tests;
#[cfg(test)]
mod edge_tests;
#[cfg(test)]
#[path = "amp_regression_tests.rs"]
mod regressions;
