use crate::models::audit_data::AmpAudit;
use scraper::{Html, Selector};
use url::Url;

mod component_rules;
mod discovery;
mod document_rules;
mod models;

#[cfg(test)]
mod tests_1;
#[cfg(test)]
mod tests_2;

use component_rules::*;
use discovery::*;
use document_rules::*;

/// Runs a bounded, deterministic subset of AMP HTML checks on the document already fetched.
pub fn audit_amp(html: &str, page_url: &str) -> AmpAudit {
    let document = Html::parse_document(html);
    let root = Selector::parse("html").expect("static html selector is valid");
    let canonical_selector = Selector::parse("link[rel~='canonical']").expect("static canonical selector is valid");

    let root_element = document.select(&root).next();
    let is_amp_document = root_element.is_some_and(|element| {
        element.value().attr("amp").is_some() || element.value().attr("⚡").is_some()
    });

    let parsed_base = Url::parse(page_url).ok();
    let mut findings = Vec::new();
    let amphtml_urls = extract_amphtml_targets(&document, parsed_base.as_ref(), &mut findings);

    let canonical_declarations = document
        .select(&canonical_selector)
        .map(|element| element.value().attr("href").map(str::trim))
        .collect::<Vec<_>>();
    let canonical_url = extract_canonical_target(&canonical_declarations, parsed_base.as_ref());

    let detected = is_amp_document || !amphtml_urls.is_empty();
    if is_amp_document {
        check_amp_canonical(&canonical_declarations, canonical_url.as_deref(), &mut findings);
        check_amp_charset_and_viewport(&document, &mut findings);
        check_amp_runtime_and_boilerplate(html, &document, &mut findings);
        check_custom_css(&document, &mut findings);
        check_forbidden_elements_and_handlers(&document, &mut findings);
        check_amp_components_and_scripts(&document, &mut findings);
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
            "Network status, redirects, canonical alignment, and content of declared AMP targets".into(),
            "Complete AMP component, CSS, attribute, and structured-data validation".into(),
        ],
    }
}
