use super::data::{list, num};
use super::strings::{report as s, t, tf};
use crate::commands::pdf_report::audit_report::ctx::{field, format_number};
use crate::commands::pdf_report::layout::text::EMPTY;
use serde_json::Value;

fn shown(value: Option<String>) -> String {
    value.unwrap_or_else(|| EMPTY.into())
}

/// Page fields that explain a finding message; empty when none apply.
pub fn page_evidence(page: &Value, message: &str) -> String {
    let lower = message.to_lowercase();
    let has = |words: &[&str]| words.iter().any(|word| lower.contains(word));
    let mut parts: Vec<String> = Vec::new();
    if has(&["title"]) {
        parts.push(tf(t(s::EV_TITLE), &[&shown(field(page, "title"))]));
    }
    if has(&["description"]) {
        parts.push(tf(
            t(s::EV_DESCRIPTION),
            &[&shown(field(page, "meta_description"))],
        ));
    }
    if has(&["canonical"]) {
        let relation = shown(field(page, "canonical_relation"));
        parts.push(tf(
            t(s::EV_CANONICAL),
            &[&shown(field(page, "canonical")), &relation],
        ));
    }
    if has(&["http", "status", "redirect", "fetch"]) {
        let status = num(page, "http_status").map(format_number);
        parts.push(tf(t(s::EV_STATUS), &[&shown(status)]));
        if let Some(error) = field(page, "request_error_kind") {
            parts.push(tf(t(s::EV_ERROR), &[&error]));
        }
    }
    if has(&["robots", "noindex", "nofollow"]) {
        let meta = shown(field(page, "meta_robots"));
        parts.push(tf(
            t(s::EV_ROBOTS),
            &[&meta, &shown(field(page, "x_robots_tag"))],
        ));
    }
    if has(&["thin", "words", "content"]) {
        parts.push(tf(
            t(s::EV_WORDS),
            &[&shown(num(page, "word_count").map(format_number))],
        ));
    }
    if has(&["h1", "heading"]) {
        parts.push(tf(
            t(s::EV_H1),
            &[&shown(num(page, "h1_count").map(format_number))],
        ));
    }
    if has(&["lang"]) {
        parts.push(tf(
            t(s::EV_LANG),
            &[&shown(field(page, "document_language"))],
        ));
    }
    if has(&["image", "alt"]) {
        let missing = list(page, "images")
            .iter()
            .filter(|i| field(i, "alt").is_none())
            .count();
        parts.push(tf(t(s::EV_IMAGES), &[&missing.to_string()]));
    }
    parts.join(" \u{b7} ")
}
