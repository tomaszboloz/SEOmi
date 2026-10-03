use super::findings::add_finding;
use crate::models::audit_data::AmpFinding;
use scraper::{Html, Selector};

pub(super) fn check(document: &Html, findings: &mut Vec<AmpFinding>) {
    let script_selector = Selector::parse("script").unwrap();
    for script in document.select(&script_selector) {
        let value = script.value();
        let src = value.attr("src").map(str::trim).unwrap_or_default();
        let script_type = value
            .attr("type")
            .map(str::trim)
            .unwrap_or_default()
            .to_ascii_lowercase();
        let extension_script =
            src.starts_with("https://cdn.ampproject.org/v0/amp-") && src.ends_with(".js");
        let runtime_script = src.trim_end_matches('/') == "https://cdn.ampproject.org/v0.js";
        let data_script = matches!(
            script_type.as_str(),
            "application/ld+json" | "application/json"
        );
        if !runtime_script && !extension_script && !data_script {
            add_finding(
            findings,
            "amp-script-not-allowlisted",
            "warning",
            "A script element was found outside the locally recognized AMP runtime/component or data-script patterns.".into(),
            if src.is_empty() { format!("inline script type={script_type:?}") } else { format!("script src={src}") },
            "Verify this script against the official AMP validator; ordinary custom JavaScript is not allowed in AMP HTML.",
        );
        }
    }
}
