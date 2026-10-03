use crate::models::audit_data::AmpFinding;
use scraper::{Html, Selector};
use url::Url;
use super::models::{add_finding, has_amp_noscript_boilerplate};

pub(super) fn check_amp_canonical(
    canonical_declarations: &[Option<&str>],
    canonical_url: Option<&str>,
    findings: &mut Vec<AmpFinding>,
) {
    if canonical_declarations.is_empty() {
        add_finding(
            findings, "amp-canonical-missing", "error",
            "AMP document does not declare a canonical URL.".into(),
            "No link[rel~=canonical][href] was found.".into(),
            "Add a canonical link to the preferred non-AMP URL (or to itself only when it is the canonical document).",
        );
        return;
    }
    let has_empty_canonical = canonical_declarations.iter().any(|href| href.map(|v| v.is_empty()).unwrap_or(true));
    if canonical_url.is_none() || has_empty_canonical {
        add_finding(
            findings, "amp-canonical-href-empty", "error",
            "AMP document declares a canonical link without a usable href.".into(),
            "link[rel~=canonical] has no non-empty href.".into(),
            "Provide one non-empty absolute or resolvable HTTP(S) canonical URL.",
        );
    }
    if canonical_declarations.len() > 1 {
        add_finding(
            findings, "amp-canonical-multiple", "warning",
            "AMP document declares more than one canonical link.".into(),
            format!("Found {} link[rel~=canonical] declarations.", canonical_declarations.len()),
            "Keep one canonical declaration for the AMP document.",
        );
    }
    if let Some(canonical) = canonical_url {
        let valid_http = Url::parse(canonical).ok().is_some_and(|url| {
            matches!(url.scheme(), "http" | "https") && url.host_str().is_some()
        });
        if !valid_http {
            add_finding(
                findings, "amp-canonical-target-invalid", "error",
                "AMP canonical does not resolve to an HTTP(S) URL.".into(),
                canonical.to_string(),
                "Use a valid absolute or resolvable HTTP(S) canonical URL.",
            );
        }
    }
}

pub(super) fn check_amp_charset_and_viewport(document: &Html, findings: &mut Vec<AmpFinding>) {
    let charset_selector = Selector::parse("meta[charset]").expect("static selector valid");
    let head_selector = Selector::parse("head").expect("static selector valid");
    let has_utf8 = document.select(&charset_selector).any(|el| {
        el.value().attr("charset").is_some_and(|v| v.trim().eq_ignore_ascii_case("utf-8"))
    });
    if !has_utf8 {
        add_finding(
            findings, "amp-charset-missing", "error",
            "AMP document is missing a UTF-8 charset declaration.".into(),
            "No meta[charset=utf-8] was found.".into(),
            "Declare <meta charset=\"utf-8\"> near the start of head; the official validator also checks its byte position.",
        );
    } else if let Some(head) = document.select(&head_selector).next() {
        let head_markup = head.html();
        let charset_position = head_markup.to_ascii_lowercase().find("charset");
        if charset_position.is_some_and(|pos| pos > 1024) {
            add_finding(
                findings, "amp-charset-position", "warning",
                "The UTF-8 charset declaration appears after the first 1024 bytes of head markup.".into(),
                format!("charset starts at byte {} of serialized head", charset_position.unwrap_or_default()),
                "Move the charset declaration close to the beginning of head; exact byte validation is not guaranteed by this parser.",
            );
        }
    }

    let viewport_selector = Selector::parse("meta[name='viewport'][content]").expect("static selector valid");
    let has_viewport = document.select(&viewport_selector).any(|el| {
        el.value().attr("content").is_some_and(|c| c.to_ascii_lowercase().contains("width=device-width"))
    });
    if !has_viewport {
        add_finding(
            findings, "amp-viewport-missing", "error",
            "AMP document is missing a viewport declaration with width=device-width.".into(),
            "No matching meta[name=viewport] was found.".into(),
            "Add a viewport meta tag containing width=device-width.",
        );
    }
}

pub(super) fn check_amp_runtime_and_boilerplate(html: &str, document: &Html, findings: &mut Vec<AmpFinding>) {
    let runtime_selector = Selector::parse("script[src]").expect("static selector valid");
    let boilerplate_selector = Selector::parse("style[amp-boilerplate]").expect("static selector valid");
    let runtime = document.select(&runtime_selector).find(|script| {
        script.value().attr("src").is_some_and(|src| {
            src.trim().trim_end_matches('/') == "https://cdn.ampproject.org/v0.js"
        })
    });
    if runtime.is_none() {
        add_finding(
            findings, "amp-runtime-missing", "error",
            "AMP runtime script was not found.".into(),
            "Missing script[src=https://cdn.ampproject.org/v0.js].".into(),
            "Include the official AMP runtime script with the async attribute.",
        );
    } else if runtime.is_some_and(|s| s.value().attr("async").is_none()) {
        add_finding(
            findings, "amp-runtime-async-missing", "error",
            "The AMP runtime script is missing the async attribute.".into(),
            "Found https://cdn.ampproject.org/v0.js without async.".into(),
            "Add the async attribute to the AMP runtime script.",
        );
    }

    if document.select(&boilerplate_selector).next().is_none() {
        add_finding(
            findings, "amp-boilerplate-missing", "error",
            "AMP boilerplate style was not found.".into(),
            "Missing style[amp-boilerplate].".into(),
            "Include the exact AMP boilerplate required by the official validator.",
        );
    }
    if !has_amp_noscript_boilerplate(html) {
        add_finding(
            findings, "amp-noscript-boilerplate-missing", "error",
            "AMP noscript boilerplate was not found.".into(),
            "Missing noscript > style[amp-boilerplate].".into(),
            "Include the official noscript AMP boilerplate fallback.",
        );
    }
}
