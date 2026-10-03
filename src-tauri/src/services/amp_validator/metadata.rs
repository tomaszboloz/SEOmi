use super::findings::add_finding;
use crate::models::audit_data::AmpFinding;
use scraper::{Html, Selector};

pub(super) fn check(document: &Html, findings: &mut Vec<AmpFinding>) {
    let charset_selector = Selector::parse("meta[charset]").unwrap();
    let head = Selector::parse("head").unwrap();
    let viewport_selector = Selector::parse("meta[name='viewport'][content]").unwrap();
    let runtime_selector = Selector::parse("script[src]").unwrap();
    let has_utf8_charset = document.select(&charset_selector).any(|element| {
        element
            .value()
            .attr("charset")
            .is_some_and(|value| value.trim().eq_ignore_ascii_case("utf-8"))
    });
    if !has_utf8_charset {
        add_finding(
        findings,
        "amp-charset-missing",
        "error",
        "AMP document is missing a UTF-8 charset declaration.".into(),
        "No meta[charset=utf-8] was found.".into(),
        "Declare <meta charset=\"utf-8\"> near the start of head; the official validator also checks its byte position.",
    );
    } else if let Some(head) = document.select(&head).next() {
        let head_markup = head.html();
        let charset_position = head_markup.to_ascii_lowercase().find("charset");
        if charset_position.is_some_and(|position| position > 1024) {
            add_finding(
            findings,
            "amp-charset-position",
            "warning",
            "The UTF-8 charset declaration appears after the first 1024 bytes of head markup.".into(),
            format!("charset starts at byte {} of serialized head", charset_position.unwrap_or_default()),
            "Move the charset declaration close to the beginning of head; exact byte validation is not guaranteed by this parser.",
        );
        }
    }

    let has_viewport = document.select(&viewport_selector).any(|element| {
        element
            .value()
            .attr("content")
            .is_some_and(|content| content.to_ascii_lowercase().contains("width=device-width"))
    });
    if !has_viewport {
        add_finding(
            findings,
            "amp-viewport-missing",
            "error",
            "AMP document is missing a viewport declaration with width=device-width.".into(),
            "No matching meta[name=viewport] was found.".into(),
            "Add a viewport meta tag containing width=device-width.",
        );
    }

    let runtime = document.select(&runtime_selector).find(|script| {
        script.value().attr("src").is_some_and(|src| {
            src.trim().trim_end_matches('/') == "https://cdn.ampproject.org/v0.js"
        })
    });
    let has_runtime = runtime.is_some();
    if !has_runtime {
        add_finding(
            findings,
            "amp-runtime-missing",
            "error",
            "AMP runtime script was not found.".into(),
            "Missing script[src=https://cdn.ampproject.org/v0.js].".into(),
            "Include the official AMP runtime script with the async attribute.",
        );
    } else if runtime.is_some_and(|script| script.value().attr("async").is_none()) {
        add_finding(
            findings,
            "amp-runtime-async-missing",
            "error",
            "The AMP runtime script is missing the async attribute.".into(),
            "Found https://cdn.ampproject.org/v0.js without async.".into(),
            "Add the async attribute to the AMP runtime script.",
        );
    }
}
