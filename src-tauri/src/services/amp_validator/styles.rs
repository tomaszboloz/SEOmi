use super::findings::add_finding;
use crate::models::audit_data::AmpFinding;
use scraper::{Html, Selector};

const AMP_CUSTOM_CSS_LIMIT_BYTES: usize = 75_000;

pub(super) fn check(document: &Html, html: &str, findings: &mut Vec<AmpFinding>) {
    let boilerplate_selector = Selector::parse("style[amp-boilerplate]").unwrap();
    let custom_css_selector = Selector::parse("style[amp-custom]").unwrap();
    if document.select(&boilerplate_selector).next().is_none() {
        add_finding(
            findings,
            "amp-boilerplate-missing",
            "error",
            "AMP boilerplate style was not found.".into(),
            "Missing style[amp-boilerplate].".into(),
            "Include the exact AMP boilerplate required by the official validator.",
        );
    }
    if !has_amp_noscript_boilerplate(html) {
        add_finding(
            findings,
            "amp-noscript-boilerplate-missing",
            "error",
            "AMP noscript boilerplate was not found.".into(),
            "Missing noscript > style[amp-boilerplate].".into(),
            "Include the official noscript AMP boilerplate fallback.",
        );
    }

    let custom_css_styles = document.select(&custom_css_selector).collect::<Vec<_>>();
    if custom_css_styles.len() > 1 {
        add_finding(
            findings,
            "amp-custom-css-multiple",
            "error",
            "The AMP document declares more than one amp-custom style block.".into(),
            format!(
                "Found {} style[amp-custom] declarations.",
                custom_css_styles.len()
            ),
            "Combine custom CSS into one style[amp-custom] block.",
        );
    }
    let custom_css_bytes = custom_css_styles
        .iter()
        .map(|style| style.text().collect::<String>().len())
        .sum::<usize>();
    if custom_css_bytes > AMP_CUSTOM_CSS_LIMIT_BYTES {
        add_finding(
        findings,
        "amp-custom-css-over-budget",
        "error",
        "The combined amp-custom CSS exceeds the common 75 KB limit.".into(),
        format!("Measured {custom_css_bytes} UTF-8 bytes; limit {AMP_CUSTOM_CSS_LIMIT_BYTES} bytes."),
        "Reduce amp-custom CSS and confirm the exact limit with the official AMP validator version used by deployment.",
    );
    }

    if custom_css_styles.iter().any(|style| {
        style
            .text()
            .collect::<String>()
            .to_ascii_lowercase()
            .contains("@import")
    }) {
        add_finding(
            findings,
            "amp-custom-css-import",
            "error",
            "The amp-custom CSS contains an @import rule.".into(),
            "style[amp-custom] contains @import".into(),
            "Inline the imported rules in the bounded amp-custom stylesheet.",
        );
    }
}

fn has_amp_noscript_boilerplate(html: &str) -> bool {
    let lower = html.to_ascii_lowercase();
    let mut remainder = lower.as_str();
    while let Some(start) = remainder.find("<noscript") {
        let block = &remainder[start..];
        let end = block.find("</noscript>").unwrap_or(block.len());
        if block[..end].contains("<style") && block[..end].contains("amp-boilerplate") {
            return true;
        }
        if end == block.len() {
            break;
        }
        remainder = &block[end + "</noscript>".len()..];
    }
    false
}
