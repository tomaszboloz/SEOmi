use super::*;
use std::collections::{BTreeMap, BTreeSet};

const MAX_FINDING_TYPES: usize = 3;
pub(super) const CRAWL_SCORE_VERSION: u16 = 2;
const CRITICAL_PENALTY_POINTS: f64 = 60.0;
const WARNING_PENALTY_POINTS: f64 = 30.0;
const MAX_PENALTY_POINTS: f64 = 80.0;
const NO_HTML_EVIDENCE_SCORE_CAP: u8 = 50;
const PARTIAL_EVIDENCE_SCORE_CAP: u8 = 90;

pub(super) struct CrawlScore {
    pub(super) critical_count: usize,
    pub(super) warning_count: usize,
    pub(super) notice_count: usize,
    pub(super) health_score: u8,
}

fn finding_type(message: &str) -> String {
    let normalized = message.trim().to_ascii_lowercase();
    let head = normalized
        .split_once(':')
        .map(|(head, _)| head.trim())
        .unwrap_or(&normalized);
    let mut key = String::with_capacity(head.len());
    let mut in_number = false;
    for character in head.chars() {
        if character.is_ascii_digit() {
            if !in_number {
                key.push('#');
                in_number = true;
            }
        } else {
            in_number = false;
            key.push(character);
        }
    }
    let key = key.trim().to_owned();
    if key.is_empty() {
        "<empty>".into()
    } else {
        key
    }
}

fn capped_finding_share(pages: &[CrawledPageSummary], severity: &str) -> f64 {
    if pages.is_empty() {
        return 0.0;
    }
    let mut pages_by_type: BTreeMap<String, BTreeSet<usize>> = BTreeMap::new();
    for (page_index, page) in pages.iter().enumerate() {
        for issue in &page.issues {
            if issue.severity == severity {
                pages_by_type
                    .entry(finding_type(&issue.message))
                    .or_default()
                    .insert(page_index);
            }
        }
    }
    let page_count = pages.len() as f64;
    let mut shares = pages_by_type
        .values()
        .map(|affected| affected.len() as f64 / page_count)
        .collect::<Vec<_>>();
    shares.sort_by(|left, right| right.total_cmp(left));
    shares.into_iter().take(MAX_FINDING_TYPES).sum()
}

/// Normalize severity by the three largest distinct finding-type page shares. Each
/// severity weight is divided across the cap, keeping the score stable as a crawl
/// grows while raw occurrence counters remain visible in the report.
fn normalized_penalty(pages: &[CrawledPageSummary]) -> f64 {
    if pages.is_empty() {
        return 0.0;
    }
    let cap = MAX_FINDING_TYPES as f64;
    let critical = capped_finding_share(pages, "Critical") / cap * CRITICAL_PENALTY_POINTS;
    let warning = capped_finding_share(pages, "Warning") / cap * WARNING_PENALTY_POINTS;
    (critical + warning).ceil().min(MAX_PENALTY_POINTS)
}

fn evidence_score_cap(pages: &[CrawledPageSummary]) -> u8 {
    if pages.is_empty() {
        return NO_HTML_EVIDENCE_SCORE_CAP;
    }
    let html_pages = pages.iter().filter(|page| {
        page.request_error_kind.is_none()
            && page
                .content_type
                .as_deref()
                .map_or(true, is_html_media_type)
    });
    let mut html_count = 0;
    let mut partial = false;
    for page in html_pages {
        html_count += 1;
        partial |= page.body_truncated || page.semantic_content_partial;
    }
    if html_count == 0 {
        NO_HTML_EVIDENCE_SCORE_CAP
    } else if partial {
        PARTIAL_EVIDENCE_SCORE_CAP
    } else {
        100
    }
}

pub(super) fn score_pages(pages: &[CrawledPageSummary]) -> CrawlScore {
    let critical_count = pages
        .iter()
        .flat_map(|p| &p.issues)
        .filter(|i| i.severity == "Critical")
        .count();

    let warning_count = pages
        .iter()
        .flat_map(|p| &p.issues)
        .filter(|i| i.severity == "Warning")
        .count();

    let notice_count = pages
        .iter()
        .flat_map(|p| &p.issues)
        .filter(|i| i.severity == "Info")
        .count();

    let penalty = normalized_penalty(pages) as u8;
    let health_score = 100u8
        .saturating_sub(penalty)
        .min(evidence_score_cap(pages))
        .max(20);

    CrawlScore {
        critical_count,
        warning_count,
        notice_count,
        health_score,
    }
}

#[cfg(test)]
#[path = "scoring_scale_tests.rs"]
mod scale_tests;
#[cfg(test)]
#[path = "scoring_tests.rs"]
mod tests;
