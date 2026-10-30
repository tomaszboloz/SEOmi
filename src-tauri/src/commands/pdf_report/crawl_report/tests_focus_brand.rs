use super::focus_brand::{hidden_gaps, profile_line};
use super::focus_cards::kpis;
use super::focus_text::percent;
use super::sec_focus::notes;
use super::strings::focus::{self as f, BRAND_REASONS};
use super::tests::text_of;
use super::tests_focus::{focus, with_focus};
use crate::commands::pdf_report::labels::default_keys;
use serde_json::json;

#[test]
fn unavailable_summary_is_not_drawn_as_a_critical_zero() {
    let summary = json!({
        "score": null, "band": "unavailable", "confidence": null, "on_topic_ratio": null,
        "unavailable": true, "page_count": 3, "core_topic": {"label": "", "terms": []},
        "counts": {"scored": 0, "skipped": 3, "off_topic": 0, "borderline": 0, "strong": 0}
    });
    let text = text_of(&with_focus(summary.clone()));
    assert!(text.contains("Site Focus Score") && text.contains("Not available"));
    assert!(text.contains("No page could be scored"));
    assert!(!text.contains("Critical focus"));
    let cards = kpis(&summary);
    assert_eq!(cards[0].value, "\u{2014}");
    assert_eq!(cards[1].value, "\u{2014}");
    assert_eq!(notes(&summary).len(), 1);
}

#[test]
fn missing_percentages_are_a_plain_dash() {
    assert_eq!(percent(None), "\u{2014}");
    assert_eq!(percent(Some(&json!(null))), "\u{2014}");
    assert_eq!(percent(Some(&json!(12.5))), "12.5%");
}

#[test]
fn profile_line_and_hidden_brand_terms_are_reported() {
    assert!(profile_line(&focus()).is_none());
    assert!(hidden_gaps(&focus()).is_none());
    let mut summary = focus();
    summary["profile"] = json!({"id": "sfs-lexical-tfidf", "algorithm_version": "sfs-2026-10-30", "config_hash": "fnv1a-0badc0de"});
    summary["brand_filtered"] = json!([
        {"term": "acme shop", "reason": "own-alias"},
        {"term": "rivalco", "reason": "competitor-brand"}
    ]);
    let line = profile_line(&summary).expect("profile line");
    assert!(line.contains("sfs-2026-10-30") && line.contains("fnv1a-0badc0de"));
    let table = hidden_gaps(&summary).expect("hidden table");
    assert_eq!(table.rows.len(), 2);
    let text = text_of(&with_focus(summary));
    assert!(text.contains("sfs-2026-10-30"));
    assert!(text.contains("rivalco") && text.contains("competitor brand"));
}

#[test]
fn brand_and_profile_keys_exist_in_english() {
    let known = default_keys();
    let mut keys: Vec<String> = BRAND_REASONS
        .iter()
        .map(|code| format!("{}.{code}", f::BRAND_REASON))
        .collect();
    keys.extend(
        [
            f::PROFILE,
            f::T_HIDDEN,
            f::HIDDEN_INTRO,
            f::COL_TERM,
            f::COL_REASON,
        ]
        .iter()
        .map(|key| (*key).to_owned()),
    );
    keys.push(format!("{}.unavailable", f::BAND));
    keys.push(format!("{}.unavailable", f::NOTE));
    let missing: Vec<_> = keys
        .iter()
        .filter(|key| !known.contains(&key.as_str()))
        .collect();
    assert!(missing.is_empty(), "missing in en.json: {missing:?}");
}
