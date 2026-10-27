//! Publication / modification date of a page for topical freshness.
//! Sources, newest wins: `article:modified_time` and similar meta tags,
//! JSON-LD `dateModified` / `datePublished`, `<time datetime>`, then the HTTP
//! `Last-Modified` header. Output is always `YYYY-MM-DD`.

use super::models::CrawledPageFocus;
use chrono::DateTime;
use regex::Regex;
use scraper::{Html, Selector};
use std::sync::OnceLock;

const META_SELECTOR: &str = "meta[property='article:modified_time'], \
    meta[property='og:updated_time'], meta[property='article:published_time'], \
    meta[itemprop='dateModified'], meta[itemprop='datePublished'], \
    meta[name='last-modified'], meta[name='date'], meta[name='dcterms.modified'], \
    meta[name='dcterms.created']";
const MAX_TIME_TAGS: usize = 20;

fn iso_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^(\d{4})-(\d{2})-(\d{2})").expect("static date regex valid"))
}

fn json_ld_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#""date(?:Modified|Published)"\s*:\s*"(\d{4}-\d{2}-\d{2})"#)
            .expect("static json-ld date regex valid")
    })
}

/// `YYYY-MM-DD` prefix of an ISO value when it is a plausible calendar date.
pub(super) fn iso_date(value: &str) -> Option<String> {
    let caps = iso_regex().captures(value.trim())?;
    let (year, month, day): (u32, u32, u32) = (
        caps[1].parse().ok()?,
        caps[2].parse().ok()?,
        caps[3].parse().ok()?,
    );
    ((1990..=2100).contains(&year) && (1..=12).contains(&month) && (1..=31).contains(&day))
        .then(|| format!("{year:04}-{month:02}-{day:02}"))
}

/// `Last-Modified` header (RFC 2822 / HTTP-date) as `YYYY-MM-DD`.
pub(super) fn http_date(value: &str) -> Option<String> {
    DateTime::parse_from_rfc2822(value.trim())
        .ok()
        .map(|date| date.format("%Y-%m-%d").to_string())
}

/// Latest date declared in the document.
pub(super) fn document_date(document: &Html) -> Option<String> {
    let mut found: Vec<String> = Vec::new();
    let meta = Selector::parse(META_SELECTOR).expect("static meta selector valid");
    for tag in document.select(&meta) {
        found.extend(tag.value().attr("content").and_then(iso_date));
    }
    let scripts = Selector::parse("script[type='application/ld+json']").expect("static selector");
    for script in document.select(&scripts) {
        let text: String = script.text().collect();
        found.extend(
            json_ld_regex()
                .captures_iter(&text)
                .filter_map(|c| iso_date(&c[1])),
        );
    }
    let times = Selector::parse("time[datetime]").expect("static time selector valid");
    for tag in document.select(&times).take(MAX_TIME_TAGS) {
        found.extend(tag.value().attr("datetime").and_then(iso_date));
    }
    found.into_iter().max()
}

impl CrawledPageFocus {
    /// Falls back to the HTTP header when the document declares no date.
    pub(super) fn dated(mut self, header: Option<&str>) -> Self {
        if self.content_date.is_none() {
            self.content_date = header.and_then(http_date);
        }
        self
    }
}

#[cfg(test)]
#[path = "tests/focus_date.rs"]
mod tests;
